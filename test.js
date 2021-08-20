const nanaParser = require('./index.js')
const nanaEvaluator = require('./evaluator.js')
const fs = require('fs')

/*
    blk = (
        x := 1;
        y := 2;
        max := |x, y| (
            x - y
        );
        1
    );
    <x; y> = blk;
    blk.max blk.x blk.y
*/

const script = `
    blk = (
        x := 1;
        y := 2;
        max := |x, y| (
            x - y
        );
        1
    );
    <x; y> = blk;
    blk.max blk.x blk.y
`

function save(result) {
    fs.writeFileSync('ast.json', JSON.stringify(result, null, 4))
}

try {
    save(nanaParser(script, save))
} catch (e) {
    console.log(e)
}

// console.log(nanaEvaluator(result))