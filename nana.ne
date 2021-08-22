@{%
const moo = require("moo")
const lexer = moo.compile({
    symbol: /_?[a-zA-Z][a-zA-Z0-9_]*'*/,
    int: /[+-]?[1-9][0-9]*/,
    float: /[+-]?(?:[1-9][0-9]*\.[0-9]*|0\.[0-9]*)(?:[eE][+-]?[1-9][0-9]*)?/,
    str: /"(?:[^\\"]|\\.)*"/,
    raw: /\[\|[\s\S]*\|\]/,
    ws: {
        match: /[ \r\n\t\v\f]+/,
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
    ".": /\./,
    "?": /\?/
})
lexer.next = (next => () => {   
  let token;
  while ((token = next.call(lexer)) && token.type === 'ws') {}
  return token;
})(lexer.next);
%}

@lexer lexer

file -> tuple_content {% ([{binder, value}]) => ({type: 'tuple', binder: binder, value: value}) %}

number -> %int {% ([data]) => ({type: 'literal', ltype: 'int', value: parseInt(data.value)}) %}
    | %float {% ([data]) => ({type: 'literal', ltype: 'float', value: parseFloat(data.value)}) %}

string -> %str {% ([data]) => ({type: 'literal', ltype: 'string', value: data.value}) %}
    | %raw {% ([data]) => ({type: 'literal', ltype: 'raw', value: data.value}) %}

literal -> number {% id %}
    | string {% id %}

symbol -> %symbol {% ([data]) => data.value %}

multi_symbol_d -> symbol {% ([data]) => ([data]) %}
    | symbol "," multi_symbol_d {% ([data, , other]) => ([data, ...other]) %}

multi_symbol_f -> symbol {% ([data]) => ([data]) %}
    | symbol ";" multi_symbol_f {% ([data, , other]) => ([data, ...other]) %}

multi_symbol_s -> symbol:+ {% id %}

gate -> "|" multi_pattern_d "|" {% ([, data]) => data %}
    | "|" "|" {% () => ([]) %}

binder -> binder_statement:+ {% id %}

binder_equ -> "=" {% () => false %}
    | ":=" {% () => true %}

multi_pattern_d -> pattern {% ([data]) => ([data]) %}
    | pattern "," multi_pattern_d {% ([data, , other]) => ([data, ...other]) %}

symbol_pattern -> symbol {% ([value]) => ({type: 'pattern', ptype: 'symbol', value}) %}

pattern -> binder_pattern {% id %}
    | tuple_pattern {% id %}
    | vector_pattern {% id %}
    | set_pattern {% id %}
    | map_pattern {% id %}
    | symbol_pattern {% id %}
    | literal {% id %}

binder_pattern -> "<" multi_symbol_f ">" {% ([, value]) => ({type: 'pattern', ptype: 'bind', value}) %}

tuple_pattern -> "(" multi_pattern_d ")" {% ([, value]) => ({type: 'pattern', ptype: 'tuple', value}) %}
    | "(" ")" {% () => ({type: 'pattern', ptype: 'tuple', value: []}) %}

vector_pattern_expand -> "[" multi_pattern_d "]" {% ([, data]) => data %}
    | "[" "]" {% () => ([]) %}

multi_vector_pattern_expand_d -> vector_pattern_expand {% id %}
    | vector_pattern_expand "+" multi_vector_pattern_expand_d {% ([data, , other]) => ([...data, ...other]) %}

vector_pattern -> multi_vector_pattern_expand_d {% ([front]) => ({type: 'pattern', ptype: 'vector', front, middle: null, back: null}) %}
    | multi_vector_pattern_expand_d "+" symbol_pattern {% ([front, , middle]) => ({type: 'pattern', ptype: 'vector', front, middle, back: null}) %}
    | symbol_pattern "+" multi_vector_pattern_expand_d {% ([middle, , back]) => ({type: 'pattern', ptype: 'vector', front, middle, back}) %}
    | multi_vector_pattern_expand_d "+" symbol_pattern "+" multi_vector_pattern_expand_d {% ([front, , middle, , back]) => ({type: 'pattern', ptype: 'vector', front, middle, back}) %}

set_pattern_expand -> "{" multi_pattern_d "}" {% ([, data]) => data %}
    | "{" "}" {% () => ([]) %}

multi_set_pattern_expand_d -> set_pattern_expand {% id %}
    | set_pattern_expand "+" multi_set_pattern_expand_d {% ([data, , other]) => ([...data, ...other]) %}

set_pattern -> multi_set_pattern_expand_d {% ([front]) => ({type: 'pattern', ptype: 'set', front, middle: null, back: null}) %}
    | multi_set_pattern_expand_d "+" symbol_pattern {% ([front, , middle]) => ({type: 'pattern', ptype: 'set', front, middle, back: null}) %}
    | symbol_pattern "+" multi_set_pattern_expand_d {% ([middle, , back]) => ({type: 'pattern', ptype: 'set', front, middle, back}) %}
    | multi_set_pattern_expand_d "+" symbol_pattern "+" multi_set_pattern_expand_d {% ([front, , middle, , back]) => ({type: 'pattern', ptype: 'set', front, middle, back}) %}

map_pattern_pair -> pattern ":" pattern {% ([key, , value]) => ({key, value}) %}

multi_map_pattern_pair_d -> map_pattern_pair {% ([data]) => ([data]) %}
    | map_pattern_pair "," multi_map_pattern_pair_d {% ([data, , other]) => ([data, ...other]) %}

map_pattern_expand -> "{" multi_map_pattern_pair_d "}" {% ([, data]) => data %}

multi_map_pattern_expand_d -> map_pattern_expand {% id %}
    | map_pattern_expand "+" multi_map_pattern_expand_d {% ([data, , other]) => ([...data, ...other]) %}

map_pattern -> multi_map_pattern_expand_d {% ([front]) => ({type: 'pattern', ptype: 'map', front, middle: null, back: null}) %}
    | multi_map_pattern_expand_d "+" symbol_pattern {% ([front, , middle]) => ({type: 'pattern', ptype: 'map', front, middle, back: null}) %}
    | symbol_pattern "+" multi_map_pattern_expand_d {% ([middle, , back]) => ({type: 'pattern', ptype: 'map', front, middle, back}) %}
    | multi_map_pattern_expand_d "+" symbol_pattern "+" multi_map_pattern_expand_d {% ([front, , middle, , back]) => ({type: 'pattern', ptype: 'map', front, middle, back}) %}

binder_statement -> pattern binder_equ expr ";" {% ([pattern, expose, value]) => ({type: 'bind', pattern, expose, value}) %}
    | symbol multi_symbol_s binder_equ expr ";" {% ([target, gate, expose, value]) => ({type: 'bindf', target, expose, value: {type: 'gate', gate, value}}) %}

value -> literal {% id %}
    | block {% id %}
    | symbol {% ([value]) => ({type: 'symbol', value}) %}

expr0_ -> "." symbol {% ([, symbol]) => ([symbol]) %}
    | "." symbol expr0_ {% ([, data, other]) => ([data, ...other]) %}

expr0 -> value {% id %}
    | value expr0_ {% ([value, member]) => ({type: 'member', value, member}) %}

expr1 -> expr0 {% id %}
    | gate expr1 {% ([gate, value]) => ({type: 'gate', gate, value}) %}

expr2_ -> expr1 {% ([arg]) => ([arg]) %}
    | expr1 expr2_ {% ([arg, other]) => ([arg, ...other]) %}

expr2 -> expr1 {% id %}
    | expr1 expr2_ {% ([func, arg]) => ({type: 'call', func, arg}) %}

expr3 -> expr2 {% id %}
    | expr2 "*" expr3 {% ([left, , right]) => ({type: 'mul', left, right}) %}
    | expr2 "/" expr3 {% ([left, , right]) => ({type: 'div', left, right}) %}

expr4 -> expr3 {% id %}
    | expr3 "+" expr4 {% ([left, , right]) => ({type: 'add', left, right}) %}
    | expr3 "-" expr4 {% ([left, , right]) => ({type: 'sub', left, right}) %}

expr -> expr4 {% id %}

exprs -> expr {% ([data]) => ([data]) %}
    | expr "," exprs {% ([data, , other]) => ([data, ...other]) %}

tuple_content -> binder exprs {% ([binder, value]) => ({binder, value}) %}
    | binder {% ([binder]) => ({binder, value: null}) %}
    | exprs {% ([value]) => ({binder: null, value}) %}
    | null {% () => ({binder: null, value: null}) %}

vector_content -> binder exprs {% ([binder, value]) => ({binder, value}) %}
    | binder {% ([binder]) => ({binder, value: null}) %}
    | exprs {% ([value]) => ({binder: null, value}) %}
    | null {% () => ({binder: null, value: null}) %}

hash_expr -> expr ":" expr {% ([key, , value]) => ({key, value}) %}

hash_exprs -> hash_expr {% ([data]) => ([data]) %}
    | hash_expr "," hash_exprs {% ([data, , other]) => ([data, ...other]) %}

hash_set_content -> binder exprs {% ([binder, value]) => ({binder, value}) %}
    | binder {% ([binder]) => ({binder, value: null}) %}
    | exprs {% ([value]) => ({binder: null, value}) %}
    | null {% () => ({binder: null, value: null}) %}

hash_map_content -> binder hash_exprs {% ([binder, value]) => ({binder, value}) %}
    | hash_exprs {% ([value]) => ({binder: null, value}) %}

tuple -> "(" tuple_content ")" {% ([, value]) => ({type: 'tuple', ...value}) %}

vector -> "[" vector_content "]" {% ([, value]) => ({type: 'vector', ...value}) %}

hash -> "{" hash_set_content "}" {% ([, value]) => ({type: 'set', ...value}) %}
    | "{" hash_map_content "}" {% ([, value]) => ({type: 'map', ...value}) %}

block -> tuple {% id %}
    | vector {% id %}
    | hash {% id %}