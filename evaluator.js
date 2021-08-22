function unwrapToNum(item) {
    while (item instanceof Object && item.type !== 'expr') {
        if (item.type === 'tuple' && item.len === 1) {
            console.log('unwrap tuple item')
            item = item.value()[0]
        } else {
            throw `perform add on type ${item.type}, size ${item.len}`
        }
    }
    if (item instanceof Object && item.type === 'expr') {
        item = item.value()
    }
    if (typeof(item) !== 'number') {
        throw `perform add on non-number literal, type ${typeof(item)}`
    }
    return item
}

function nanaEval(ast, fv = () => ([false, "", null])) {
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
                fv,
                init: function () {
                    this.sfv = (symbol) => {
                        if (symbol in this.bind) {
                            return [true, this.bindtype[symbol], this.bind[symbol]]
                        } else if (symbol in this.gate && this.gate[symbol]) {
                            return [true, this.gatetype[symbol], this.gate[symbol]]
                        } else {
                            return this.fv(symbol)
                        }
                    } 
                },
                value: function () {
                    console.log('calculate tuple')
                    const ret = []
                    for (const e of ast.value) {
                        ret.push(nanaEval(e, this.sfv))
                    }
                    // console.log(ret)
                    return ret
                }
            }
            result.init()
            for (const b of ast.binder || []) {
                if (b.type === 'bind') {
                    if (b.pattern.ptype === 'bind') { // <;> we bind it now
                        const v = nanaEval(b.value) // as we don't need value, we don't provide fv
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
                } else { // function/gate
                    // TODO
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
                fv,
                init: function () {
                    this.sfv = (symbol) => {
                        if (symbol in this.bind) {
                            return [true, this.bindtype[symbol], this.bind[symbol]]
                        } else if (symbol in this.gate && this.gate[symbol]) {
                            return [true, this.gatetype[symbol], this.gate[symbol]]
                        } else {
                            return this.fv(symbol)
                        }
                    } 
                },
                value: function () {
                    console.log('calculate vector')
                    const ret = []
                    for (const e of ast.value || []) {
                        ret.push(nanaEval(e, this.sfv))
                    }
                    // console.log(ret)
                    return ret
                }
            }
            result.init()
            for (const b of ast.binder || []) {
                if (b.type === 'bind') {
                    if (b.pattern.ptype === 'bind') { // <;> we bind it now
                        const v = nanaEval(b.value) // as we don't need value, we don't provide fv
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
                        const v = nanaEval(b.value, (s) => {
                            if (s in result.bind) {
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
                            result.bind[k] = bd[k]
                            result.bindtype[k] = bts[k]
                            console.log(`:bind ${k} to type ${bts[k]}`)
                            if (b.expose) {
                                result.exposed[k] = result.bind[k]
                            }
                        }
                    }
                } else { // function/gate
                    // TODO
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
        case 'add':
        case 'sub':
        case 'mul':
        case 'div':
            return {
                type: 'expr',
                method: ast.type,
                left: nanaEval(ast.left, fv),
                right: nanaEval(ast.right, fv),
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
                        match(value, binds, bindtypes) {
                            console.log('tuple pattern match called')
                            if (!(value instanceof Object) || value.type !== 'tuple') {
                                console.warn(`pattern match failed | tuple | value type ${value.type}`)
                                return false
                            }
                            const V = value.value(fv)
                            if (V.length !== this.pat.length) {
                                console.warn(`pattern match failed | tuple | length mismatch, pattern ${this.pat.length}, value ${V.length}`)
                                return false
                            }
                            for (let i = 0; i < this.pat.length; i++) {
                                const pat = this.pat[i]
                                const val = V[i]
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
                        match(value, binds, bindtypes) {
                            console.log('vector pattern match called')
                            if (!(value instanceof Object) || value.type !== 'vector') {
                                console.warn(`pattern match failed | vector | value type ${value.type}`)
                                return false
                            }
                            const V = value.value(fv)
                            if (this.rest) {
                                if (V.length < this.front.length + this.back.length) {
                                    console.warn(`pattern match failed | vector | length too short, pattern ${this.front.length} + ? + ${this.back.length}, value ${V.length}`)
                                    return false
                                }
                            } else {
                                if (V.length !== this.front.length + this.back.length) {
                                    console.warn(`pattern match failed | vector | length mismatch, pattern ${this.front.length} + ${this.back.length}, value ${V.length}`)
                                    return false
                                }
                            }
                            for (let i = 0; i < this.front.length; i++) {
                                const pat = this.front[i]
                                const val = V[i]
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
                                    value: () => (V.slice(this.front.length, -this.back.length))
                                }, binds, bindtypes)) {
                                    return false
                                }
                            }
                            for (let i = V.length - this.back.length; i < V.length; i++) {
                                const pat = this.back[i]
                                const val = V[i]
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
                return value.value()
        }
    } else {
        return value
    }
}

module.exports = {
    nanaEval,
    nanaEvaluator
}