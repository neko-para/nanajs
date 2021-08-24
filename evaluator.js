function dump(obj) {
    if (obj instanceof Function) {
        return obj
    } else if (obj instanceof Array) {
        return obj.map(dump)
    } else if (obj instanceof Object) {
        const o = {}
        for (const k in obj) {
            o[k] = dump(obj[k])
        }
        return o
    } else {
        return obj
    }
}

function unwrapToNum(item) {
    while (item instanceof Object) {
        if (item.type === 'tuple' && item.len === 1) {
            console.log('unwrap tuple item')
            item = item.value()[0]
        } else if (['expr', 'member'].includes(item.type)) {
            item = item.value()
        } else {
            throw `perform add on type ${item.type}, size ${item.len}`
        }
    }
    if (typeof(item) !== 'number') {
        throw `perform add on non-number literal, type ${typeof(item)}, value ${item}`
    }
    return item
}

function nanaEval(ast, fv = () => ([false, "", null])) {
    const Eval = d => nanaEval(d, fv)
    switch (ast.type) {
        case 'tuple': {
            const result = {
                type: 'tuple',
                len: ast.value.length,
                exposed: {},
                bind: {},
                bindtype: {},
                gate: {},
                gatetype: {},
                gatepat: [],
                gateuse: {},
                fv,
                sfv: function (symbol) {
                    if (symbol in this.bind) {
                        return [true, this.bindtype[symbol], this.bind[symbol]]
                    } else if (symbol in this.gate && this.gate[symbol]) {
                        return [true, this.gatetype[symbol], this.gate[symbol]]
                    } else {
                        return this.fv(symbol)
                    }
                },
                value: function () {
                    console.log('calculate tuple')
                    const ret = []
                    for (const e of ast.value) {
                        ret.push(nanaEval(e, d => this.sfv(d)))
                    }
                    // console.log(ret)
                    return ret
                }
            }
            for (const b of ast.binder || []) {
                if (b.pattern.ptype === 'bind') {
                    const v = nanaEval(b.value, (s) => {
                        if (s in result.gate) {
                            return [true, result.gatetype[s], result.gate[s]]
                        } else {
                            return result.fv(s)
                        }
                    })
                    for (const s of b.pattern.value) {
                        if (s in result.bind) {
                            throw `shadow ${s} in tuple`
                        }
                        if (!(s in v.exposed)) {
                            throw `bind ${s} which is not exposed`
                        }
                        result.bind[s] = v.exposed[s]
                        result.bindtype[s] = v.bindtype[s]
                        console.log(`:bind ${s} to type ${result.bindtype[s]}`)
                        if (b.expose) {
                            result.exposed[s] = result.bind[s]
                        }
                    }
                } else {
                    const bd = {}
                    const v = nanaEval(b.value, (s) => {
                        if (s in bd) {
                            return [true, result.bindtype[s], result.bind[s]]
                        } else if (s in result.gate) {
                            return [true, result.gatetype[s], result.gate[s]]
                        } else {
                            return result.fv(s)
                        }
                    })
                    const bts = {}
                    const p = nanaEval(b.pattern)
                    if (!p.match(v, bd, bts)) {
                        throw `pattern match failed`
                    }
                    for (const k in bd) {
                        if (k in result.bind) {
                            throw `shadow ${k} in tuple`
                        }
                        result.bind[k] = bd[k]
                        result.bindtype[k] = bts[k]
                        console.log(`:bind ${k} to type ${bts[k]}`)
                        if (b.expose) {
                            result.exposed[k] = result.bind[k]
                        }
                    }
                }
            }
            return result
        }
        case 'vector': {
            const result = {
                type: 'vector',
                len: ast.value.length,
                exposed: {},
                bind: {},
                bindtype: {},
                gate: {},
                gatetype: {},
                gatepat: [],
                gateuse: {},
                fv,
                sfv: function (symbol) {
                    if (symbol in this.bind) {
                        return [true, this.bindtype[symbol], this.bind[symbol]]
                    } else if (symbol in this.gate && this.gate[symbol]) {
                        return [true, this.gatetype[symbol], this.gate[symbol]]
                    } else {
                        return this.fv(symbol)
                    }
                },
                value: function () {
                    console.log('calculate vector')
                    const ret = []
                    for (const e of ast.value || []) {
                        ret.push(nanaEval(e, d => this.sfv(d)))
                    }
                    // console.log(ret)
                    return ret
                }
            }
            for (const b of ast.binder || []) {
                const v = nanaEval(b.value, (s) => {
                    if (s in result.bind) {
                        return [true, result.bindtype[s], result.bind[s]]
                    } else if (s in result.gate) {
                        return [true, result.gatetype[s], result.gate[s]]
                    } else {
                        return result.fv(s)
                    }
                })
                if (b.pattern.ptype === 'bind') {
                    for (const s of b.pattern.value) {
                        if (!(s in v.exposed)) {
                            throw `bind ${s} which is not exposed`
                        }
                        result.bind[s] = v.exposed[s]
                        result.bindtype[s] = v.bindtype[s]
                        console.log(`:bind ${s} to type ${result.bindtype[s]}`)
                        if (b.expose) {
                            result.exposed[s] = result.bind[s]
                        }
                    }
                } else {
                    const bd = {}
                    const bts = {}
                    const p = nanaEval(b.pattern)
                    if (!p.match(v, bd, bts)) {
                        throw `pattern match failed`
                    }
                    for (const k in bd) {
                        result.bind[k] = bd[k]
                        result.bindtype[k] = bts[k]
                        console.log(`:bind ${k} to type ${bts[k]}`)
                        if (b.expose) {
                            result.exposed[k] = result.bind[k]
                        }
                    }
                }
            }
            return result
        }
        case 'symbol': {
            const [r, t, v] = fv(ast.value)
            if (!r) {
                throw `cannot locate symbol ${ast.value}`
            }
            if (t === 'number' || t === 'string') {
                return v
            }
            return v
        }
        case 'gate': {
            const v = dump(nanaEval(ast.value, fv))
            if (!(v instanceof Object)) {
                throw `gate on non-object, value type ${typeof(v)}`
            }
            const ps = ast.gate.map(Eval)
            for (let i = ps.length - 1; i >= 0; i--) {
                const syms = ps[i].symbols()
                const ks = []
                for (const s of syms) {
                    if (!(s in v.gateuse)) {
                        v.gateuse[s] = true
                        ks.push(s)
                    }
                }
                console.log('gate symbols ', syms)
                v.gatepat = [[ks, ps[i]], ...v.gatepat]
            }
            return v
        }
        case 'call': {
            const f = dump(Eval(ast.func))
            if (!(f instanceof Object)) {
                throw `call on non-object, value type ${typeof(f)}`
            }
            const bd = {}
            const bts = {}
            let argi = 0
            while (argi < ast.arg.length && f.gatepat.length > 0) {
                const [gs, gp] = f.gatepat[0]
                f.gatepat = f.gatepat.slice(1)
                const v = Eval(ast.arg[argi++])
                const d = {}
                const t = {}
                if (!gp.match(v, d, t)) {
                    throw `pattern match failed | call | item ${argi} match failed`
                }
                for (const k of gs) {
                    bd[k] = d[k]
                    bts[k] = t[k]
                    delete d[k]
                }
                for (const k in d) {
                    console.log(`skip shadow bind ${k}`)
                }
            }
            for (const k in bd) {
                f.gate[k] = bd[k]
                f.gatetype[k] = bts[k]
                console.log(`install symbol ${k}`)
            }
            return f
        }
        case 'member':
            return {
                type: 'member',
                obj: Eval(ast.value),
                member: ast.member,
                value() {
                    console.log(`get member ${this.member}`)
                    if (!(this.obj instanceof Object)) {
                        throw `indexing non-object, value type ${typeof(this.obj)}`
                    }
                    if (this.member in this.obj.exposed) {
                        return this.obj.exposed[this.member]
                    } else if (this.member in this.obj.bind) {
                        throw `cannot get non-exposed member ${this.member}`
                    } else {
                        throw `cannot find member ${this.member}`
                    }
                }
            }
        case 'add':
        case 'sub':
        case 'mul':
        case 'div':
            return {
                type: 'expr',
                method: ast.type,
                left: Eval(ast.left),
                right: Eval(ast.right),
                value() {
                    console.log(`calculate ${ast.type}`)
                    let tl = unwrapToNum(this.left)
                    let tr = unwrapToNum(this.right)
                    switch (ast.type) {
                        case 'add':
                            return tl + tr
                        case 'sub':
                            return tl - tr
                        case 'mul':
                            return tl * tr
                        case 'div':
                            if (tr === 0) {
                                throw 'divide on zero'
                            }
                            return tl / tr
                    }
                }
            }
        case 'literal':
            return ast.value
        case 'pattern':
            switch (ast.ptype) {
                case 'tuple':
                    return {
                        data: ast,
                        pat: ast.value ? ast.value.map(nanaEval) : [],
                        symbols() {
                            let rs = []
                            for (let i = 0; i < this.pat.length; i++) {
                                const pat = this.pat[i]
                                rs = rs.concat(pat.symbols())
                            }
                            return rs
                        },
                        match(value, binds, bindtypes) {
                            console.log('tuple pattern match called')
                            if (!(value instanceof Object) || value.type !== 'tuple') {
                                console.warn(`pattern match failed | tuple | value type ${value.type}`)
                                return false
                            }
                            const v = value.value(fv)
                            if (v.length !== this.pat.length) {
                                console.warn(`pattern match failed | tuple | length mismatch, pattern ${this.pat.length}, value ${v.length}`)
                                return false
                            }
                            for (let i = 0; i < this.pat.length; i++) {
                                const pat = this.pat[i]
                                const val = v[i]
                                if (pat instanceof Object) {
                                    if (!pat.match(val, binds, bindtypes)) {
                                        console.log(`pattern match failed | tuple | item ${i} match failed`)
                                        return false
                                    }
                                } else { // literal
                                    if(pat !== val) {
                                        console.log(`pattern match failed | tuple | literal mismatch, pattern ${pat}, value ${val} `)
                                        return false
                                    }
                                }
                            }
                            return true
                        }
                    }
                case 'vector':
                    return {
                        data: ast,
                        front: ast.front ? ast.front.map(nanaEval) : [],
                        back: ast.back ? ast.back.map(nanaEval) : [],
                        rest: ast.middle ? nanaEval(ast) : null,
                        symbols() {
                            let rs = []
                            for (let i = 0; i < this.front.length; i++) {
                                const pat = this.front[i]
                                rs = rs.concat(pat.symbols())
                            }
                            if (this.rest) {
                                rs = rs.concat(this.rest.symbols())
                            }
                            for (let i = 0; i < this.back.length; i++) {
                                const pat = this.back[i]
                                rs = rs.concat(pat.symbols())
                            }
                            return rs
                        },
                        match(value, binds, bindtypes) {
                            console.log('vector pattern match called')
                            if (!(value instanceof Object) || value.type !== 'vector') {
                                console.warn(`pattern match failed | vector | value type ${value.type}`)
                                return false
                            }
                            const v = value.value(fv)
                            if (this.rest) {
                                if (v.length < this.front.length + this.back.length) {
                                    console.warn(`pattern match failed | vector | length too short, pattern ${this.front.length} + ? + ${this.back.length}, value ${v.length}`)
                                    return false
                                }
                            } else {
                                if (v.length !== this.front.length + this.back.length) {
                                    console.warn(`pattern match failed | vector | length mismatch, pattern ${this.front.length} + ${this.back.length}, value ${v.length}`)
                                    return false
                                }
                            }
                            for (let i = 0; i < this.front.length; i++) {
                                const pat = this.front[i]
                                const val = v[i]
                                if (pat instanceof Object) {
                                    if (!pat.match(val, binds, bindtypes)) {
                                        console.log(`pattern match failed | vector | item ${i} match failed`)
                                        return false
                                    }
                                } else { // literal
                                    if(pat !== val) {
                                        console.log(`pattern match failed | vector | literal mismatch, pattern ${pat}, value ${val} `)
                                        return false
                                    }
                                }
                            }
                            if (this.rest) {
                                if (!this.rest.match({
                                    type: 'vector',
                                    value: () => (v.slice(this.front.length, -this.back.length))
                                }, binds, bindtypes)) {
                                    return false
                                }
                            }
                            for (let i = v.length - this.back.length; i < v.length; i++) {
                                const pat = this.back[i]
                                const val = v[i]
                                if (pat instanceof Object) {
                                    if (!pat.match(val, binds, bindtypes)) {
                                        console.log(`pattern match failed | vector | item ${i} match failed`)
                                        return false
                                    }
                                } else { // literal
                                    if(pat !== val) {
                                        console.log(`pattern match failed | vector | literal mismatch, pattern ${pat}, value ${val} `)
                                        return false
                                    }
                                }
                            }
                            return true
                        }
                    }
                case 'symbol':
                    return {
                        symbols() {
                            if (ast.value === '_') {
                                return []
                            } else {
                                return [ast.value]
                            }
                        },
                        match(value, binds, bindtypes) {
                            console.log('symbol pattern match called')
                            if (ast.value === '_') {
                                return true
                            }
                            if (ast.value in binds) {
                                console.log(`pattern match failed | symbol | cannot rebind ${ast.value}`)
                                return false
                            }
                            if (!(value instanceof Object))
                                console.log(`:bind ${ast.value} to`, value)
                            binds[ast.value] = value
                            bindtypes[ast.value] = value instanceof Object ? value.type : typeof(value)
                            return true
                        }
                    }
            }
    }
}

function nanaEvaluator(value) {
    if (value instanceof Object) {
        switch (value.type) {
            case 'tuple': {
                let v = value.value().map(nanaEvaluator)
                return v.length === 1 ? v[0] : v
            }
            case 'vector':
                return value.value().map(nanaEvaluator)
            case 'expr':
            case 'member':
                return value.value()
            default:
                return `$$$NEED RESOLVE@${value.type}$$$`
        }
    } else {
        return value
    }
}

module.exports = {
    nanaEval,
    nanaEvaluator
}