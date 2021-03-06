#!/usr/bin/env node

const fs = require('fs')

if (process.argv.length < 3) {
    console.error("File not specified")
    process.exit(1)
}

let file = fs.readFileSync(process.argv[2]).toString()
let inject = (x) => file += x
global.inject = inject
global.F = {}

let pass_1_prefix = '%#'
let idx = process.argv.findIndex(x => x === '--prefix')
if (idx !== -1) { /// --prefix = %#
    if (process.argv.length - 1 === idx) {
        console.error('Expected string after \'--prefix\'')
        process.exit(1)
    }

    pass_1_prefix = process.argv[idx + 1]
}

let pass_2_prefix = '%##'
let second_pass = false
let idx2 = process.argv.findIndex(x => x === '--pass-2-prefix')
if (idx2 !== -1) { /// --prefix = %#
    if (process.argv.length - 1 === idx2) {
        console.error('Expected string after \'--pass-2-prefix\'')
        process.exit(1)
    }

    pass_2_prefix = process.argv[idx2 + 1]
}

function do_pass(prefix) {
	let last = 0
	for (;;) {
		let pos = file.indexOf(prefix + 'eval', last)
		if (pos < 0) break
		let end = pos

		let buf = ''
		let defun = false
		let defmacro = false
		let funcdecl = ''
		while (file[end] !== '\n') buf += file[end++]

		if (buf.includes(prefix + 'eval begin') || buf.includes(prefix + 'eval defun')) {
			if (buf.includes(prefix + 'eval defun')) defun = true
			funcdecl = buf.slice(buf.indexOf('n') + 1).trim()
			let start = end
			end = file.indexOf(prefix + 'eval end')
			if (end < 0) {
				console.error(prefix + 'eval begin/defun terminated by end of file')
				process.exit(1)
			}

			buf = file.slice(start, end)
			end += 8 + prefix.length /// strlen("eval end") = 8
		} else if (buf.includes(prefix + 'eval defmacro ')) {
			buf = buf.slice(prefix.length + 'eval defmacro '.length)
			defmacro = true
		} else buf = buf.slice(prefix.length + 'eval'.length)


		let tail = file.slice(end)
		file = file.slice(0, pos)
		if (defun) {
			funcdecl = funcdecl.split(' ')
			funcname = funcdecl.shift()
			if (funcdecl.length) F[funcname] = new Function(...funcdecl, buf)
			else F[funcname] = new Function(buf)
		} else if (defmacro) {
			buf = buf.trim().split(' ')
			let macroname = buf[0].trim()
			let macroval = buf[1].replaceAll('<SP>', ' ')
			tail = tail.replaceAll(macroname, macroval)
		} else {
			let retval = (new Function('fs', 'process', 'F', 'inject', 'console', buf))(fs, process, F, inject, console)
			if (retval) file += retval
		}
		file += tail
		last = pos
	}
}

do_pass(pass_1_prefix)
do_pass(pass_2_prefix)

if (process.argv.includes("--kern-en-dashes")) {
	file = file.replaceAll(/(?<=\d)(???|--)(?=\d)/g, "\\kern1pt--\\kern1pt")
}

process.stdout.write(file)
