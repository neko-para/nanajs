const fs = require('fs')
let file = fs.readFileSync('nana.ne').toString()

file = file.replace(/@?\{%[\s\S]*?%\}/g, '').replace(/@lexer lexer/, '')
fs.writeFileSync('nana.bnf', file)