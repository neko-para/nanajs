function split(array, cond, proc) {
    const ret = [[]]
    for (const item of array) {
        if (cond(item)) {
            ret.push([])
        } else {
            proc(item)
            ret[ret.length - 1].push(item)
        }
    }
    return ret
}

function* transferLiteral(tokens) {
    for (const token of tokens) {
        if (['int', 'float', 'str'].includes(token.type)) {
            token.littype = token.type
            token.type = 'literal'
        }
        yield token
    }
}

function matchParen(tokens) {
    const tmp = [[]]
    const stk = []
    const paren = {
        '>': '<',
        ')': '(',
        ']': '[',
        '}': '{',
        '|': '|'
    }
    for (const t of tokens) {
        if (t.type === 'token') {
            if (['>', ')', ']', '}', '|'].includes(t.value) && (t.value !== '|' || (stk.length > 0 && stk[stk.length - 1] === '|'))) {
                if (stk.length === 0 || stk.pop() !== paren[t.value]) {
                    throw 'parenthese mismatch'
                }
                const seq = tmp.pop()
                tmp[tmp.length - 1].push({
                    type: 'block',
                    key: paren[t.value],
                    value: seq
                })
                continue
            }
            if (['<', '(', '[', '{', '|'].includes(t.value)) {
                stk.push(t.value)
                tmp.push([])
                continue
            }
        }
        tmp[tmp.length - 1].push(t)
    }
    return tmp.pop()
}

function matchGate(tokens) {
    const ret = []
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (token.type !== 'block' || token.key !== '|') {
            if (token.type === 'block') {
                token.value = matchGate(token.value)
            }
            ret.push(token)
        } else {
            if (i + 1 === tokens.length) {
                throw 'unexpected EOF after gate'
            }
            const nxt = tokens[++i]
            if (nxt.type !== 'block' || ['<', '|'].includes(nxt.key)) {
                throw `unexpected ${nxt.type} ${nxt.value} after gate`
            }
            nxt.gate = token
            ret.push(nxt)
        }
    }
    return ret
}

function splitBlocks(token) {
    if (token.key === '(' && token.value.length === 1 && token.value[0].type === 'block' && !(['<', '|'].includes(token.value[0].key))) {
        const sub = token.value[0]
        splitBlocks(sub)
        token.type = sub.type
        token.key = sub.key
        token.value = sub.value
    } else {
        const value = split(token.value,
            t => t.type === 'token' && t.value === ';',
            t => {
                if (t.type === 'block') {
                    splitBlocks(t)
                }
            })
        const valueSpace = value.pop()
        token.value = {
            binder: value,
            value: valueSpace
        }
    }
}

function wrapSpecialBlock(token) {
    if (token.key === '<') {
        token.type = 'binder tuple'
        token.value = [...token.value.binder, token.value.value].map(ts => {
            if (ts.length === 0) {
                throw 'need symbol inside <>'
            }
            if (ts.length > 1) {
                throw 'too much symbol inside <> which should be seperate by ;'
            }
            const t = ts[0]
            if (t.type !== 'symbol') {
                throw `unexpected ${t.type} inside <> which must be symbol`
            }
            return t.value
        })
    } else if (token.key === '|') {
        if (token.value.binder.length > 0) {
            throw 'no binder statement inside gate'
        }
        token.value = token.value.value.map(t => {
            return t.value
        })
    } else {
        for (const ts of token.value.binder) {
            for (const t of ts) {
                if (t.type === 'block') {
                    wrapSpecialBlock(t)
                }
            }
        }
        for (const t of token.value.value) {
            if (t.type === 'block') {
                wrapSpecialBlock(t)
            }
        }
    }
}

function concatSymbol(token) {
    function processTokens(ts) {
        let sym = null
        let meetDot = false
        const ret = []
        for (const t of ts) {
            if (t.type === 'block') {
                concatSymbol(t)
                ret.push(t)
            } else if (t.type === 'symbol') {
                if (sym && !meetDot) {
                    ret.push(sym)
                    sym = null
                }
                if (sym === null) {
                    sym = t
                    sym.value = [sym.value]
                } else {
                    sym.value.push(t.value)
                    meetDot = false
                }
            } else if (t.type === 'token' && t.value === '.') {
                if (sym) {
                    meetDot = true
                } else {
                    throw 'unexpected token .'
                }
            } else {
                if (sym) {
                    if (meetDot) {
                        throw `unexpected ${t.type} ${t.value} after dot`
                    }
                    ret.push(sym)
                    sym = null
                }
                ret.push(t)
            }
        }
        if (sym) {
            if (meetDot) {
                throw `unexpected EOF after dot`
            }
            ret.push(sym)
        }
        return ret
    }
    token.value.binder = token.value.binder.map(processTokens)
    token.value.value = processTokens(token.value.value)
}

function parseBinder(token) {
    token.value.binder = token.value.binder.map(tokens => {
        if (tokens.length < 3) {
            throw 'binder statement too short'
        }
        const left = tokens[0]
        const assign = tokens[1]
        const right = tokens.slice(2)
        for (const t of right) {
            if (t.type === 'block') {
                parseBinder(t)
            }
        }
        if (assign.type !== 'token' || !(['=', ':='].includes(assign.value))) {
            throw `binder statement need = or := but found ${assign.type} ${assign.value}`
        }
        if (left.type !== 'symbol' && left.type !== 'binder tuple') {
            throw `unexpected ${left.type} ${left.value} at the left of ${assign.value}`
        }
        return {
            type: 'bind',
            target: left,
            expose: assign.value === ':=',
            value: right
        }
    })
    for (const t of token.value.value) {
        if (t.type === 'block') {
            parseBinder(t)
        }
    }
}

function splitValue(token) {
    token.value.value = split(token.value.value,
        t => t.type === 'token' && t.value === ',',
        t => {
            if (t.type === 'block') {
                splitValue(t)
            }
        })
    for (const b of token.value.binder) {
        for (const t of b.value) {
            if (t.type === 'block') {
                splitValue(t)
            }
        }
    }
}

function detectHash(token) {
    if (token.key === '{') {
        let isHash = -1
        token.value.value = token.value.value.map(v => {
            const r = split(v,
                t => t.type === 'token' && t.value === ':',
                () => {})
            if (r.length > 2) {
                throw 'too much : inside {}'
            }
            if (r.length === 2) {
                if (isHash === 0) {
                    throw 'mixing of set and map'
                }
                isHash = 1
                if (r[0].length === 0) {
                    throw 'no key provided'
                }
                if (r[0].length > 1) {
                    throw 'too much key provided'
                }
                if (r[0][0].type !== 'literal') {
                    throw `unexpected ${r[0].type} ${r[0].value} before :`
                }
                return {
                    key: r[0][0],
                    value: r[1]
                }
            } else {
                if (isHash === 1) {
                    throw 'mixing of set and map'
                }
                isHash = 0
                return {
                    value: r[0]
                }
            }
        })
        token.value.value.forEach(v => {
            if (v.value.type === 'block') {
                detectHash(v.value)
            }
        })
        token.value.valuetype = isHash ? 'map' : 'set'
    }
    for (const b of token.value.binder) {
        for (const t of b.value) {
            if (t.type === 'block') {
                detectHash(t)
            }
        }
    }
}

export function nanaParser(tokens) {
    tokens = matchParen(transferLiteral(tokens))
    tokens = matchGate(tokens)
    const token = {
        type: 'block',
        key: '(',
        value: tokens
    }
    splitBlocks(token)
    wrapSpecialBlock(token)
    concatSymbol(token)
    parseBinder(token)
    splitValue(token)
    detectHash(token)
    return token
}