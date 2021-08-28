const nanaParser = require('./index.js')
const nanaEvaluate = require('./eval.js')
const fs = require('fs')

/*
    <tc> = [
        blk = (
            x := 1;
            y := 2;
            max := |x, y| (
                x - y
            );
            1
        );
        tc := blk.max blk.x;
    ];
    ? tc -1 == 2
    | x -> x + 2
    | 0 -> "WTF?"
*/

const script = `
[
    factorial x := (
        ? x
        | 0 -> 1
        | _ -> x * factorial (x - 1)
    );
    factorial 4
]
`

function save(result) {
    fs.writeFileSync('ast.json', JSON.stringify(result, null, 4))
}

try {
    const result = nanaParser(script, save)
    save(result)
    console.log(nanaEvaluate(result))
} catch (e) {
    console.log('error:', e)
}
