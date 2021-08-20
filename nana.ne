@{%
const moo = require("moo")
const lexer = moo.compile({
    symbol: /[a-zA-Z_'][a-zA-Z0-9_']*/,
    int: /[+-]?[1-9][0-9]*/,
    float: /[+-]?(?:[1-9][0-9]*\.[0-9]*|0\.[0-9]*)(?:[eE][+-]?[1-9][0-9]*)?/,
    str: /"(?:[^\\]|\\["\\bfnrtv]|\\u[0-9a-fA-F]{4})*"/,
    raw: /\[\|[\s\S]*\|\]/,
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

file -> _ tuple_content _ {% ([, {binder, value}]) => ({type: 'tuple', binder: binder, value: value}) %}

_ -> null
    | %ws

__ -> %ws

number -> %int {% ([data]) => ({type: 'literal', ltype: 'int', value: parseInt(data.value)}) %}
    | %float {% ([data]) => ({type: 'literal', ltype: 'float', value: parseFloat(data.value)}) %}

string -> %str {% ([data]) => ({type: 'literal', ltype: 'string', value: data.value}) %}
    | %raw {% ([data]) => ({type: 'literal', ltype: 'raw', value: data.value}) %}

literal -> number {% id %}
    | string {% id %}

symbol -> %symbol {% ([data]) => data.value %}

multi_symbol_d -> symbol {% ([data]) => ([data]) %}
    | symbol _ "," _ multi_symbol_d {% ([data, , , , other]) => ([data, ...other]) %}

multi_symbol_f -> symbol {% ([data]) => ([data]) %}
    | symbol _ ";" _ multi_symbol_f {% ([data, , , , other]) => ([data, ...other]) %}

multi_symbol_s -> symbol {% ([data]) => ([data]) %}
    | symbol _ multi_symbol_s {% ([data, , other]) => ([data, ...other]) %}

gate -> "|" _ multi_symbol_d _ "|" {% ([, , data]) => data %}
    | "|" _ "|" {% () => ([]) %}

binder -> binder_statement {% ([data]) => ([data]) %}
    | binder_statement _ binder {% ([data, , other]) => ([data, ...other]) %}

binder_equ -> "=" {% () => false %}
    | ":=" {% () => true %}

binder_statement -> symbol _ binder_equ _ expr _ ";" {% ([target, , expose, , value]) => ({type: 'bind', target, expose, value}) %}
    | symbol _ multi_symbol_s _ binder_equ _ expr _ ";" {% ([target, , gate, , expose, , value]) => ({type: 'bind', target, expose, value: {type: 'gate', gate, value}}) %}
    | "<" _ multi_symbol_f _ ">" _ binder_equ _ expr _ ";" {% ([, , targets, , , , expose, , value]) => ({}) %}

value -> literal {% id %}
    | block {% id %}
    | symbol {% ([value]) => ({type: 'symbol', value}) %}

expr0_ -> "." _ symbol {% ([, , symbol]) => ([symbol]) %}
    | "." _ symbol _ expr0_ {% ([, , data, , other]) => ([data, ...other]) %}

expr0 -> value {% id %}
    | value _ expr0_ {% ([value, , member]) => ({type: 'member', value, member}) %}

expr1 -> expr0 {% id %}
    | gate _ expr1 {% ([gate, , value]) => ({type: 'gate', gate, value}) %}

expr2_ -> expr1 {% ([arg]) => ([arg]) %}
    | expr1 _ expr2_ {% ([arg, , other]) => ([arg, ...other]) %}

expr2 -> expr1 {% id %}
    | expr1 _ expr2_ {% ([func, , arg]) => ({type: 'call', func, arg}) %}

expr3 -> expr2 {% id %}
    | expr2 _ "*" _ expr3 {% ([left, , , , right]) => ({type: 'mul', left, right}) %}
    | expr2 _ "/" _ expr3 {% ([left, , , , right]) => ({type: 'div', left, right}) %}

expr4 -> expr3 {% id %}
    | expr3 _ "+" _ expr4 {% ([left, , , , right]) => ({type: 'add', left, right}) %}
    | expr3 _ "-" _ expr4 {% ([left, , , , right]) => ({type: 'sub', left, right}) %}

expr -> expr4 {% id %}

exprs -> expr {% ([data]) => ([data]) %}
    | expr _ "," _ exprs {% ([data, , , , other]) => ([data, ...other]) %}

tuple_content -> binder _ exprs {% ([binder, , value]) => ({binder, value}) %}
    | binder {% ([binder]) => ({binder, value: null}) %}
    | exprs {% ([value]) => ({binder: null, value}) %}
    | _ {% () => ({binder: null, value: null}) %}

vector_content -> binder _ exprs {% ([binder, , value]) => ({binder, value}) %}
    | binder {% ([binder]) => ({binder, value: null}) %}
    | exprs {% ([value]) => ({binder: null, value}) %}
    | _ {% () => ({binder: null, value: null}) %}

hash_expr -> expr _ ":" _ expr {% ([key, , , , value]) => ({key, value}) %}

hash_exprs -> hash_expr {% ([data]) => ([data]) %}
    | hash_expr _ "," _ hash_exprs {% ([data, , , , other]) => ([data, ...other]) %}

hash_set_content -> binder _ exprs {% ([binder, , value]) => ({binder, value}) %}
    | binder {% ([binder]) => ({binder, value: null}) %}
    | hash_exprs {% ([value]) => ({binder: null, value}) %}
    | _ {% () => ({binder: null, value: null}) %}

hash_map_content -> binder _ hash_exprs {% ([binder, , value]) => ({binder, value}) %}
    | hash_exprs {% ([value]) => ({binder: null, value}) %}

tuple -> "(" _ tuple_content _ ")" {% ([, , value]) => ({type: 'tuple', value}) %}

vector -> "([" _ vector_content _ "]" {% ([, , value]) => ({type: 'vector', value}) %}

hash -> "{" _ hash_set_content _ "}" {% ([, , value]) => ({type: 'set', value}) %}
    | "{" _ hash_map_content _ "}" {% ([, , value]) => ({type: 'map', value}) %}

block -> tuple {% id %}
    | vector {% id %}
    | hash {% id %}