const nearley = require('nearley')
const grammar = require('./nanane.js')

module.exports = function nanaParser(input) {
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    parser.feed(input)
    return parser.results
}
