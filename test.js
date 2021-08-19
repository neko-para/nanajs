const nanaParser = require('./index.js')
const fs = require('fs')

const script = `
    blk = {
        x := 1;
        y := 2;
        max := |x, y| [
            x - y
        ];
        1
    };
    <x; y> = blk;
    blk.max blk.x blk.y
`
const result = nanaParser(script)

console.log(result.length)
fs.writeFileSync('ast.json', JSON.stringify(result, null, 4))