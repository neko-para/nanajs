function dump(obj) {
    if (obj instanceof Function) {
        return obj
    } else if (obj instanceof Array) {
        return obj.map(dump)
    } else if (obj instanceof Object) {
        const o = {}
        for (const k in obj) {
            if (k === 'parent') { // skip recursive
                o.parent = obj.parent
                continue
            }
            o[k] = dump(obj[k])
        }
        return o
    } else {
        return obj
    }
}

function nanaEval(ast, parent = null, asvalue = false) {
    let Eval = (a) => nanaEval(a, parent, asvalue)
    switch (ast.type) {
        case 'literal':
            return ast.value
        case 'symbol': {
            const key = ast.value
            while (parent) {
                if (asvalue || parent.type !== 'tuple') {
                    if (key in parent.bind) {
                        return parent.bind[key]
                    }
                }
                if (key in parent.gate) {
                    return parent.gate[key]
                }
                if (parent.type === 'tuple' && key === parent.name) {
                    return parent
                }
                parent = parent.parent
            }
            throw `cannot locate symbol ${key}`
        }
        case 'tuple': {
            const ret = {
                type: 'tuple',
                parent,
                gate: {},
                bind: {},
                expose: {},
                gatepat: (ast.gate || []).map(nanaEval),
                gatecache: [],
                value: [],
                process() {
                    if (this.gatepat.length !== this.gatecache.length) {
                        throw `process failed | tuple | gate count not match, pattern ${this.gatepat.length}, cache ${this.gatecache.length}`
                    }
                    for (let i = this.gatepat.length - 1; i >= 0; i--) {
                        const g = {}
                        if (!this.gatepat[i].match(this.gatecache[i], g)) {
                            throw `process failed | tuple | gate item ${i} match failed`
                        }
                        for (const k in g) {
                            if (!(k in this.gate)) {
                                this.gate[k] = g[k]
                            }
                        }
                    }
                    for (const b of ast.binder || []) {
                        const p = nanaEval(b.pattern)
                        const v = nanaEval(b.value, this)
                        if (!p.match(v, this.bind)) {
                            throw `bind failed | tuple | pattern match failed`
                        }
                        if (b.expose) {
                            for (const k of p.symbols()) {
                                this.expose[k] = this.bind[k]
                            }
                        }
                    }
                    for (const vst of ast.value || []) {
                        const v = nanaEval(vst, this, true)
                        this.value.push(v)
                    }
                    this.processed = true
                }
            }
            if (ret.gatepat.length === 0) { // no gate at all
                ret.process()
            }
            if ((ast.value || []).length === 1 && !ast.forcetuple && ast.binder === null && ret.processed) {
                return ret.value[0]
            } else {
                return ret
            }
        }
        case 'vector': {
            const ret = {
                type: 'vector',
                parent,
                gate: {},
                bind: {},
                expose: {},
                gatepat: (ast.gate || []).map(nanaEval),
                gatecache: [],
                value: [],
                process() {
                    if (this.gatepat.length !== this.gatecache.length) {
                        throw `process failed | vector | gate count not match, pattern ${this.gatepat.length}, cache ${this.gatecache.length}`
                    }
                    for (let i = this.gatepat.length - 1; i >= 0; i--) {
                        const g = {}
                        if (!this.gatepat[i].match(this.gatecache[i], g)) {
                            throw `process failed | vector | gate item ${i} match failed`
                        }
                        for (const k in g) {
                            if (!(k in this.gate)) {
                                this.gate[k] = g[k]
                            }
                        }
                    }
                    for (const b of ast.binder || []) {
                        const p = nanaEval(b.pattern)
                        const v = nanaEval(b.value, this)
                        const bd = {}
                        if (!p.match(v, bd)) {
                            throw `bind failed | vector | pattern match failed`
                        }
                        for (const k in bd) {
                            this.bind[k] = bd[k]
                            if (b.expose) {
                                this.expose[k] = bd[k]
                            }
                        }
                    }
                    for (const vst of ast.value || []) {
                        const v = nanaEval(vst, this, true)
                        this.value.push(v)
                    }
                    this.processed = true
                }
            }
            if (ret.gatepat.length === 0) { // no gate at all
                ret.process()
            }
            return ret
        }
        case 'add':
        case 'sub':
        case 'mul':
        case 'div': {
            const l = Eval(ast.left)
            const r = Eval(ast.right)
            if (typeof(l) !== 'number' || typeof(r) !== 'number') {
                throw `perform operation on non-number | left ${typeof(l)}, right ${typeof(r)}`
            }
            switch (ast.type) {
                case 'add':
                    return l + r
                case 'sub':
                    return l - r
                case 'mul':
                    return l * r
                case 'div':
                    if (r === 0) {
                        throw `divide on zero`
                    }
                    return l / r
            }
            throw `why it's here`
        }
        case 'member': {
            let v = Eval(ast.value)
            if (!v.processed) {
                throw `getting member failed | value not processed`
            }
            for (let i = 0; i < ast.member.length; i++) {
                const m = ast.member[i]
                if (!(v instanceof Object)) {
                    throw `getting member failed | indexing non-object`
                }
                if (!(m in v.expose)) {
                    if (m in v.bind) {
                        throw `getting member failed | member ${m} not exposed`
                    } else {
                        throw `getting member failed | member ${m} not exist`
                    }
                }
                v = v.expose[m]
            }
            return v;
        }
        case 'call': {
            const ret = dump(Eval(ast.func))
            ret.gatecache = ret.gatecache.concat(ast.arg.map(Eval))
            if (!ret.processed && ret.gatecache.length >= ret.gatepat.length) {
                ret.process()
            }
            return ret;
        }
        case 'pattern':
            switch (ast.ptype) {
                case 'tuple':
                    return {
                        pat: ast.value ? ast.value.map(nanaEval) : [],
                        symbols() {
                            let rs = []
                            for (let i = 0; i < this.pat.length; i++) {
                                const pat = this.pat[i]
                                rs = rs.concat(pat.symbols())
                            }
                            return rs
                        },
                        match(value, binds) {
                            if (!(value instanceof Object) || value.type !== 'tuple') {
                                console.log(`pattern match failed | tuple | value type ${value.type}`)
                                return false
                            }
                            if (!value.processed) {
                                throw `pattern match failed | tuple | value not processed yet`
                            }
                            const v = value.value
                            if (v.length !== this.pat.length) {
                                console.log(`pattern match failed | tuple | length mismatch, pattern ${this.pat.length}, value ${v.length}`)
                                return false
                            }
                            for (let i = 0; i < this.pat.length; i++) {
                                const pat = this.pat[i]
                                const val = v[i]
                                if (!pat.match(val, binds)) {
                                    console.log(`pattern match failed | tuple | item ${i} match failed`)
                                    return false
                                }
                            }
                            return true
                        }
                    }
                case 'vector':
                    return {
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
                        match(value, binds) {
                            if (!(value instanceof Object) || value.type !== 'vector') {
                                console.log(`pattern match failed | vector | value type ${value.type}`)
                                return false
                            }
                            if (!value.processed) {
                                throw `pattern match failed | vector | value not processed yet`
                            }
                            const v = value.value
                            if (this.rest) {
                                if (v.length < this.front.length + this.back.length) {
                                    console.log(`pattern match failed | vector | length too short, pattern ${this.front.length} + ? + ${this.back.length}, value ${v.length}`)
                                    return false
                                }
                            } else {
                                if (v.length !== this.front.length + this.back.length) {
                                    console.log(`pattern match failed | vector | length mismatch, pattern ${this.front.length} + ${this.back.length}, value ${v.length}`)
                                    return false
                                }
                            }
                            for (let i = 0; i < this.front.length; i++) {
                                const pat = this.front[i]
                                const val = v[i]
                                if (!pat.match(val, binds)) {
                                    console.log(`pattern match failed | vector | item ${i} match failed`)
                                    return false
                                }
                            }
                            if (this.rest) {
                                if (!this.rest.match({
                                    type: 'vector',
                                    value: v.slice(this.front.length, -this.back.length)
                                }, binds)) {
                                    return false
                                }
                            }
                            for (let i = v.length - this.back.length; i < v.length; i++) {
                                const pat = this.back[i]
                                const val = v[i]
                                if (!pat.match(val, binds)) {
                                    console.log(`pattern match failed | vector | item ${i} match failed`)
                                    return false
                                }
                            }
                            return true
                        }
                    }
                case 'literal':
                    return {
                        symbols() {
                            return []
                        },
                        match(value) {
                            if (value instanceof Object) {
                                if (!value.processed) {
                                    throw `pattern match failed | literal | value not processed yet`
                                }
                                console.log(`pattern match failed | literal | value type ${value.type}`)
                                return false
                            }
                            if (value !== ast.value) {
                                console.log(`pattern match failed | literal | value ${value}, pattern ${ast.value}`)
                                return false
                            }
                            return true
                        }
                    }
                case 'bind':
                    return {
                        symbols() {
                            return ast.value.filter(s => s !== '_')
                        },
                        match(value, binds) {
                            if (!(value instanceof Object)) {
                                console.log(`pattern match failed | bind | value type ${typeof(value)}`)
                                return false
                            }
                            if (!value.processed) {
                                throw `pattern match failed | bind | value not processed`
                            }
                            for (const k of ast.value) {
                                if (!(k in value.expose)) {
                                    console.log(`pattern match failed | bind | cannot locate ${k}`)
                                }
                                if (k in binds) {
                                    console.log(`pattern match failed | bind | cannot rebind ${k}`)
                                    return false
                                }
                                const v = value.expose[k]
                                if (!(v instanceof Object))
                                    console.log(`:bind ${k} to`, v)
                                else
                                    console.log(`:bind ${k} to ${v.type}`)
                                binds[k] = v
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
                        match(value, binds) {
                            if (ast.value === '_') {
                                return true
                            }
                            if (ast.value in binds) {
                                console.log(`pattern match failed | symbol | cannot rebind ${ast.value}`)
                                return false
                            }
                            if (!(value instanceof Object))
                                console.log(`:bind ${ast.value} to`, value)
                            else
                                console.log(`:bind ${ast.value} to ${value.type}`)
                            binds[ast.value] = value
                            value.name = ast.value
                            return true
                        }
                    }
            }
    }
}

function nanaCalc(val) {
    if (val instanceof Object) {
        if (!val.processed) {
            console.warn(val)
            throw `calculate failed | value not processed`
        }
        switch (val.type) {
            case 'tuple':
                if (val.value && val.value.length === 1 && !val.forcetuple) {
                    return nanaCalc(val.value[0])
                }
                // fall through
            case 'vector':
                return val.value.map(nanaCalc)
            default:
                throw `${val.type} not implement yet`
        }
    } else {
        if (typeof(val) === 'string') {
            if (val[0] === '"') {
                val = val.substr(1, val.length - 2)
            }
            // TODO: unescape string
        }
        return val
    }
}

function nanaEvaluate(ast) {
    const v = nanaEval(ast)
    return nanaCalc(v)
}

module.exports = nanaEvaluate