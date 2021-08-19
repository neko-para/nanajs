@{%
const moo = require("moo")
const lexer = moo.compile({
    symbol: /[a-zA-Z_'][a-zA-Z0-9_']*/,
    int: /[+-]?[1-9][0-9]*/,
    float: /[+-]?(?:[1-9][0-9]*\.[0-9]*|0\.[0-9]*)(?:[eE][+-]?[1-9][0-9]*)?/,
    str: /"(?:[^\\]|\\["\\bfnrtv]|\\u[0-9a-fA-F]{4})*"/,
    ws: {
        match: /[ \n\t\v\f]+/,
        lineBreaks: true
    },
    "(": /\(/,
    ")": /\)/,
    "[": /\[/,
    "]": /\]/,
    "{": /{/,
    "}": /}/,
    "<": /</,
    ">": />/,
    "->": /->/,
    "=": /=/,
    ":=": /:=/,
    "+": /\+/,
    "-": /-/,
    "*": /\*/,
    "/": /\//,
    "|": /\|/,
    ";": /;/,
    ":": /:/,
    ",": /,/,
    ".": /\./
})
%}
@lexer lexer

file -> _ {% function (data) {
    return {
        type: 'tuple',
        binder: null,
        value: null
    }
} %}
    | _ binder _ value_d _ {% function (data) {
    return {
        type: 'tuple',
        binder: data[1],
        value: data[3]
    }
} %}

_ -> null
    | %ws

__ -> %ws

number -> %int {% data => parseInt(data[0].value) %}
    | %float {% data => parseFloat(data[0].value) %}

string -> %str {% data => data[0].value %}

literal -> number {% data => data[0] %}
    | string {% data => data[0] %}

symbol -> %symbol {% function (data) {
    return {
        type: 'symbol',
        value: data[0].value
    }
} %}

csymbol -> symbol {% function (data) {
    return [ data[0] ]
} %}
    | symbol "." csymbol {% function (data) {
        return [ data[0], ...data[2] ]
    } %}

symbol_d -> symbol {% function (data) {
    return [ data[0] ]
} %}
    | symbol _ "," _ symbol_d {% function (data) {
        return [ data[0], ...data[4] ]
    } %}

symbol_f -> symbol {% function (data) {
    return [ data[0] ]
} %}
    | symbol _ ";" _ symbol_d {% function (data) {
        return [ data[0], ...data[4] ]
    } %}

symbol_s -> symbol {% function (data) {
    return [ data[0] ]
} %}
    | symbol __ symbol_s {% function (data) {
        return [ data[0], ...data[2] ]
    } %}

gate -> "|" _ symbol_d _ "|" {% function (data) {
    return {
        type: 'gate',
        value: data[2].map(s => s.value)
    }
}%}

value_d -> value {% function (data) {
    return [ data[0] ]
} %}
    | value _ "," _ value_d {% function (data) {
        return [ data[0], ...data[4] ]
    } %}

value_hash_d -> literal _ ":" _ value {% function (data) {
    return [
        {
            key: data[0],
            value: data[4]
        }
    ]
} %}
    | literal _ ":" _ value _ "," _ value_hash_d {% function (data) {
        return [
            {
                key: data[0],
                value: data[4]
            },
            ...data[8]
        ]
    } %}

binder_equ -> "=" {% data => data[0] %}
    | ":=" {% data => data[0] %}

binder -> null {% data => null %}
    | _ symbol _ binder_equ _ value _ ";" binder {% function (data) {
        return [
            {
                type: 'binder',
                target: data[1].value,
                expose: data[3] === ':=',
                value: data[5]
            },
            ...(data[8] || [])
        ]
    } %}
    | _ symbol_s _ binder_equ _ block _ ";" binder {% function (data) {
        return [
            {
                type: 'binder',
                target: data[1][0],
                expose: data[3] === ':=',
                value: {
                    type: 'function',
                    gate: data[1].slice(1).map(s => s.value),
                    block: data[5]
                }
            },
            ...(data[8] || [])
        ]
    } %}
    | _ "<" _ symbol_f _ ">" _ binder_equ _ block _ ";" binder {% function (data) {
        return [
            {
                type: 'binders',
                target: data[3],
                expose: data[7] === ':=',
                value: data[9]
            },
            ...(data[13] || [])
        ]
    } %}
    | _ "<" _ symbol_f _ ">" _ binder_equ _ csymbol _ ";" binder {% function (data) {
        return [
            {
                type: 'binders',
                target: data[3],
                expose: data[7] === ':=',
                value: data[9]
            },
            ...(data[13] || [])
        ]
    } %}

tuple -> "(" _ ")" {% function (data) { return { type: 'tuple' } } %}
    | "(" _ binder _ value_d _ ")" {% function (data) {
        return {
            type: 'tuple',
            binder: data[2],
            value: data[4]
        }
    } %}

vector -> "[" _ "]" {% function (data) { return { type: 'vector' } } %}
    | "[" _ binder _ value_d _ "]" {% function (data) {
        return {
            type: 'vector',
            binder: data[2],
            value: data[4]
        }
    } %}

hash -> "{" _ "}" {% function (data) { return { type: 'set' } } %}
    | "{" _ binder _ value_d _ "}" {% function (data) {
        return {
            type: 'set',
            binder: data[2],
            value: data[4]
        }
    } %}
    | "{" _ binder _ value_hash_d _ "}" {% function (data) {
        return {
            type: 'map',
            binder: data[2],
            value: data[4]
        }
    } %}

block -> tuple {% data => data[0] %}
    | vector {% data => data[0] %}
    | hash {% data => data[0] %}

gate_block -> gate _ block {% function (data) {
    return {
        type: 'function',
        gate: data[0].value,
        block: data[2]
    }
} %}

func -> csymbol {% data => data[0] %}
    | gate_block {% data => data[0] %}

func_call -> func _ values {% function (data) {
    return {
        type: 'call',
        function: data[0],
        argument: data[2]
    }
} %}

value -> expr {% data => data[0] %}
    | gate_block {% data => data[0] %}
    | string {% data => data[0] %}

values -> value {% function (data) {
    return [ data[0] ]
} %}
    | value __ values {% function (data) {
        return [ data[0], ...data[2] ]
    } %}


num -> number {% data => data[0] %}
    | csymbol {% data => data[0] %}
    | block {% data => data[0] %}
    | func_call {% data => data[0] %}

num2 -> num {% data => data[0] %}
    | num _ op2 _ num2 {% function (data) {
        let r = data[4]
        if (r.type !== 'muldiv') {
            r = [
                {
                    type: 'muldiv',
                    value: r,
                    div: data[2] === '/'
                }
            ]
        } else if (data[2] === '/') {
            r = r.value.map(s => {
                s.div = !s.div
            })
        } else {
            r = r.value
        }
        return {
            type: 'muldiv',
            value: [
                {
                    value: data[0],
                    div: false
                },
                ...r
            ]
        }
    } %}

expr -> num2 {% data => data[0] %}
    | num2 _ op1 _ expr {% function (data) {
        let r = data[4]
        if (r.type !== 'addsub') {
            r = [
                {
                    type: 'addsub',
                    value: r,
                    sub: data[2] === '-'
                }
            ]
        } else if (data[2] === '-') {
            r = r.value.map(s => {
                s.sub = !s.sub
            })
        } else {
            r = r.value
        }
        return {
            type: 'addsub',
            value: [
                {
                    value: data[0],
                    sub: false
                },
                ...r
            ]
        }
    } %}

op1 -> "+" {% data => data[0].value %}
    | "-" {% data => data[0].value %}

op2 -> "*" {% data => data[0].value %}
    | "/" {% data => data[0].value %}