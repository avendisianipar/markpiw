import {schema, doc, blockquote, h1, h2, p, li, ul, eq} from "prosemirror-test-builder"
import {Transform} from "prosemirror-transform"
import {Slice, Fragment, Node} from "prosemirror-model"
import ist from "ist"

let r = (n: number) => Math.floor(Math.random() * n)

function randomText(len: number) {
  let txt = ""
  for (; len > 0; len--) txt += String.fromCharCode(97 + r(26))
  return txt
}

function randomStep(tr: Transform) {
  let sel = r(5), len = tr.doc.content.size
  if (sel == 0 || sel == 1) {
    let markSel = r(3)
    let mark = markSel == 0 ? schema.marks.strong.create()
      : markSel == 1 ? schema.marks.em.create()
      : schema.marks.link.create({href: "/" + r(5)})
    let from = r(len) - 1
    let to = Math.min(len, from + r(10))
    if (sel) tr.addMark(from, to, mark)
    else tr.removeMark(from, to, mark)
  } else if (sel == 2) {
    tr.insert(r(len - 2) + 1, schema.text(randomText(r(2) + 1)))
  } else if (sel == 3 && len > 2) {
    let from = r(len - 3) + 1
    let to = Math.min(len - 1, from + 1 + r(8))
    tr.delete(from, to)
  } else {
    let block = r(2) ? p() : h1()
    let pos = r(len - 2) + 1
    tr.replace(pos, pos, new Slice(Fragment.from([block, block]), 1, 1))
  }
  return tr
}

function randomDoc(minLen: number) {
  let blocks: Node[] = [], len = 0
  while (len < minLen) {
    let txt = randomText(Math.min(minLen - len, r(6) + 2)), sel = r(5), block
    if (sel == 0) block = h2(txt)
    else if (sel == 1) block = blockquote(p(txt))
    else if (sel == 2) block = ul(li(p(txt)), li(p(randomText(5))))
    else block = p(txt)
    blocks.push(block)
    len += block.nodeSize
  }
  return doc(...blocks)
}

describe("Step.invert", () => {
  it("reverts to the previous document", () => {
    for (let i = 0; i < 200; i++) {
      let tr = new Transform(randomDoc(40))
      for (let j = 0; j < 10; j++) {
        let start = tr.doc, startI = tr.steps.length
        randomStep(tr)
        let d = tr.doc
        for (let k = tr.steps.length - 1; k >= startI; k--)
          d = tr.steps[k].invert(tr.docs[k]).apply(d).doc!
        ist(d, start, eq)
      }
    }
  })

  it("reverts accurately when mapped", () => {
    for (let i = 0; i < 1000; i++) {
      let start = randomDoc(40)
      let step = randomStep(new Transform(start)).steps[0]
      if (!step) continue
      let other = randomStep(new Transform(start))
      let mapped = step.map(other.mapping)
      if (!mapped) continue
      let doc = mapped.apply(other.doc).doc
      if (!doc) continue
      ist(mapped.invert(other.doc).apply(doc).doc!, other.doc, eq)
    }
  })
})
