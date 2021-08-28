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
            } else {
                o[k] = dump(obj[k])
            }
        }
        return o
    } else {
        return obj
    }
}

function unwrap(obj) {
    if (obj instanceof Object && obj.type === 'tuple' && obj.processed && !obj.forcetuple && obj.value.length === 1 && Object.keys(obj.bind).length === 0) {
        return [obj.value[0], true]
    } else {
        return [obj, false]
    }
}

function unwraps(obj) {
    for (;;) {
        const [o, f] = unwrap(obj)
        if (f) {
            obj = o
        } else {
            break
        }
    }
    return obj
}
/*
// number < string < tuple < vector < set < map

function compare(o1, o2) {
    const typeOrder = ['number', 'string', 'tuple', 'vector', 'set', 'map']
    const typeCompare = {
        number: (n1, n2) => n1 - n2,
        string: (s1, s2) => s1.localeCompare(s2),
        tuple: (t1, t2) => {
            if (!t1.processed || !t2.processed) {
                throw `compare failed | value not processed`
            }
            if (t1.value.length !== t2.value.length) {
                return t1.value.length - t2.value.length
            } else {
                for (let i = 0; i < t1.value.length; i++) {
                    const c = compare(t1.value[i], t2.value[i])
                    if (c !== 0) {
                        return c
                    }
                }
                return 0
            }
        }
    }
    const t1 = o1 instanceof Object ? o1.type : typeof(o1)
    const t2 = o2 instanceof Object ? o2.type : typeof(o2)
    const to1 = typeOrder.indexOf(t1)
    const to2 = typeOrder.indexOf(t2)
    if (to1 !== to2) {
        return to1 - to2
    } else {
        return typeCompare[t1](o1, o2)
    }
}
*/

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
                    return parent.parent.bind[key]
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
                        for (const v of this.gatecache) {
                            console.log(v)
                        }
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
            return unwraps(ret)
        }
        case 'vector': {
            const ret = {
                type: 'vector',
                parent,
                forcetuple: ast.forcetuple,
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
        case 'div':
        case 'greater':
        case 'lesser':
        case 'nongreater':
        case 'nonlesser':
        case 'equal':
        case 'nonequal': {
            const l = unwraps(Eval(ast.left))
            const r = unwraps(Eval(ast.right))
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
                case 'greater':
                    return l > r ? 1 : 0
                case 'lesser':
                    return l < r ? 1 : 0
                case 'nongreater':
                    return l >= r ? 1 : 0
                case 'nonlesser':
                    return l <= r ? 1 : 0
                case 'equal':
                    return l === r ? 1 : 0
                case 'nonequal':
                    return l !== r ? 1 : 0
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
            const v = Eval(ast.func)
            if (v.processed) {
                console.warn(`calling on processed block`)
            }
            const ret = dump(v)
            ret.gatecache = [...ret.gatecache, ...ast.arg.map(Eval)]
            if (!ret.processed && ret.gatecache.length >= ret.gatepat.length) {
                ret.process()
            }
            return unwraps(ret)
        }
        case 'test': {
            const v = Eval(ast.cond)
            if (v instanceof Object && !v.processed) {
                throw `test failed | value not processed`
            }
            console.log(`testing`, v)
            const fd = []
            for (const c of ast.cases) {
                const cp = nanaEval(c.pattern)
                const cbd = {}
                if (cp.match(v, cbd)) {
                    fd.push(c)
                }
            }
            if (fd.length === 0) {
                throw `test failed | no match found`
            }
            if (fd.length > 1) {
                console.warn(`test failed | too much match(${fd.length}) found, use first match`)
            }
            const c = fd[0]
            const tmp = {
                type: 'call',
                func: {
                    type: 'tuple',
                    binder: null,
                    gate: [c.pattern],
                    value: [c.value]
                },
                arg: [
                    ast.cond
                ]
            }
            return Eval(tmp)
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