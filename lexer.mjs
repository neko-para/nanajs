function isDigit(n) {
    return n >= 48 && n <= 57
}

function isAlpha(n) {
    return (n >= 65 && n <= 90) || (n >= 97 && n <= 122)
}

function isHDigit(n) {
    return isDigit(n) || (n >= 65 && n <= 70) || (n >= 97 && n <= 101)
}

export function* nanaLex(input = "") {
    const chars = input.split('').map(s => s.codePointAt(0))
    let pos = 0
    let token = null
    let inStr = false
    let inRaw = false
    while (pos < chars.length) {
        const ch = chars[pos++]
        if (inStr) {
            if (ch === 34) { // "
                yield token
                inStr = false
                token = null
            } else if (ch === 92) { // \
                if (pos >= chars.length) {
                    throw "unexpected EOF after \\ in string literal"
                }
                const ech = chars[pos++]
                const escMap = {
                    34: '"',
                    92: '\\',
                    98: '\b',
                    102: '\f',
                    110: '\n',
                    114: '\r',
                    116: '\t',
                    118: '\v',
                }
                if (ech in escMap) {
                    token.value += escMap[ech]
                } else if (ech === 120) { // \u
                    if (pos + 4 >= chars.length) {
                        throw "not enough chars after \\u in string literal"
                    }
                    let code = 0
                    for (let i = 0; i < 4; i++) {
                        const c = chars[pos + i]
                        if (!isHDigit(c)) {
                            throw `unexpected non-hex char ${String.fromCodePoint(c)} after \\u in string literal`
                        }
                        code *= 16
                        code += isDigit(c) ? c - 48 : (c < 97 ? c - 55 : c - 87)
                    }
                    token.value += String.fromCodePoint(code)
                } else {
                    throw `unexpected char ${String.fromCodePoint(ech)} after \\ in string literal`
                }
            } else {
                token.value += String.fromCodePoint(ch)
            }
        } else if (inRaw) {
            if (ch === 124) { // |
                if (pos >= chars.length) {
                    throw "unexpected EOF in raw literal"
                }
                const ech = chars[pos]
                if (ech === 93) { // ]
                    pos++
                    yield token
                    inRaw = false
                    token = null
                } else {
                    token.value += '|'
                }
            } else {
                token.value += String.fromCodePoint(ch)
            }
        } else if (ch === 34) {
            if (token) {
                yield token
            }
            token = {
                type: 'str',
                value: ''
            }
            inStr = true
        } else if (ch === 91 && pos < chars.length && chars[pos] === 124) {
            if (token) {
                yield token
            }
            pos++
            token = {
                type: 'raw',
                value: ''
            }
            inRaw = true
        } else if (isDigit(ch)) {
            if (token && (token.type === 'int' || token.type === 'float' || token.type === 'symbol')) {
                token.value += String.fromCodePoint(ch)
            } else {
                if (token) {
                    yield token
                }
                token = {
                    type: 'int',
                    value: String.fromCodePoint(ch)
                }
            }
        } else if (isAlpha(ch) || ch === 39 || ch === 95) { // alpha ' _
            if (token && token.type === 'symbol') {
                token.value += String.fromCodePoint(ch)
            } else {
                if (token) {
                    yield token
                }
                token = {
                    type: 'symbol',
                    value: String.fromCodePoint(ch)
                }
            }
        } else if (ch === 46) { // .
            if (token && token.type === 'int') {
                token.type = 'float'
                token.value += '.'
            } else {
                if (token) {
                    yield token
                }
                token = {
                    type: 'token',
                    value: '.'
                }
            }
        } else if (ch === 61) { // =
            if (token && token.type === 'token' && token.value === ':') {
                token.value = ':='
            } else {
                if (token) {
                    yield token
                }
                token = {
                    type: 'token',
                    value: '='
                }
            }
        } else if ([
            43, // +
            45, // -
            42, // *
            47, // /
            37, // %
            44, // ,
            58, // :
            59, // ;
            124, // |
            40, 41, // ()
            60, 62, // <>
            91, 93, // []
            123, 125, // {}
        ].includes(ch)) {
            if (token) {
                yield token
            }
            token = {
                type: 'token',
                value: String.fromCodePoint(ch)
            }
        } else if (ch === 32 || ch === 9 || ch === 10 || ch === 13) { // space \t \n \r
            if (token) {
                yield token
                token = null
            }
        } else {
            throw `unexpected char with codo ${ch}`
        }
    }
    if (token) {
        if (token.type === 'str' || token.type === 'raw') {
            throw `unexpected EOF in ${token.type} literal`
        } else {
            yield token
        }
    }
}