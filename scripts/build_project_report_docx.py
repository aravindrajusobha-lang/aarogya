"""Build an editable, approximately 30-page DOCX from docs/PROJECT_REPORT.md.

Uses only Python's standard library. Each <!-- PAGE BREAK --> marker creates a
Word page break, so edit the Markdown source and rerun this script to regenerate.
"""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "PROJECT_REPORT.md"
OUTPUT = ROOT / "docs" / "PROJECT_REPORT.docx"
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def run(text: str, *, bold=False, italic=False, code=False):
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if code:
        props.extend(['<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>', '<w:sz w:val="18"/>'])
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f"<w:r>{rpr}<w:t xml:space=\"preserve\">{escape(text)}</w:t></w:r>"


def inline(text: str):
    result = []
    pattern = re.compile(r"(\*\*.+?\*\*|`.+?`|\*[^*]+\*)")
    pos = 0
    for match in pattern.finditer(text):
        if match.start() > pos:
            result.append(run(text[pos:match.start()]))
        value = match.group()
        if value.startswith("**"):
            result.append(run(value[2:-2], bold=True))
        elif value.startswith("`"):
            result.append(run(value[1:-1], code=True))
        else:
            result.append(run(value[1:-1], italic=True))
        pos = match.end()
    if pos < len(text):
        result.append(run(text[pos:]))
    return "".join(result)


def paragraph(text="", style=None, *, page_break=False, code=False):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    if page_break:
        return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    if code:
        content = run(text or " ", code=True)
        ppr = '<w:pPr><w:spacing w:after="0"/><w:ind w:left="240"/></w:pPr>'
        return f"<w:p>{ppr}{content}</w:p>"
    return f"<w:p>{ppr}{inline(text)}</w:p>"


def table_xml(rows):
    out = ['<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>']
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        out.append(f'<w:{edge} w:val="single" w:sz="4" w:space="0" w:color="CAD9CF"/>')
    out.append('</w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:start w:w="95" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:end w:w="95" w:type="dxa"/></w:tblCellMar></w:tblPr>')
    for row_index, row in enumerate(rows):
        out.append("<w:tr>")
        for cell in row:
            shade = '<w:shd w:fill="EAF4ED"/>' if row_index == 0 else ""
            cell_text = cell.strip().strip("*")
            out.append(f'<w:tc><w:tcPr>{shade}<w:vAlign w:val="top"/></w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr>{inline(cell_text)}</w:p></w:tc>')
        out.append("</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def parse_markdown(source: str):
    lines = source.splitlines()
    blocks = []
    i = 0
    in_code = False
    while i < len(lines):
        line = lines[i]
        if line.strip() == "```text" or line.strip() == "```":
            in_code = not in_code
            i += 1
            continue
        if in_code:
            blocks.append(paragraph(line, code=True))
            i += 1
            continue
        if line.strip() == "<!-- PAGE BREAK -->":
            blocks.append(paragraph(page_break=True))
            i += 1
            continue
        if not line.strip():
            i += 1
            continue
        if line.startswith("|"):
            raw_rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [cell.strip() for cell in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                    raw_rows.append(cells)
                i += 1
            blocks.append(table_xml(raw_rows))
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            title = line[level:].strip()
            blocks.append(paragraph(title, style=f"Heading{min(level, 3)}"))
            i += 1
            continue
        if line.startswith("> "):
            blocks.append(paragraph(line[2:].strip(), style="Quote"))
            i += 1
            continue
        if re.match(r"^\s*[-*] ", line):
            blocks.append(paragraph("•  " + re.sub(r"^\s*[-*] ", "", line), style="ListText"))
            i += 1
            continue
        if re.match(r"^\s*\d+\. ", line):
            blocks.append(paragraph(re.sub(r"^\s*", "", line), style="ListText"))
            i += 1
            continue
        if line.strip() == "---":
            i += 1
            continue
        # Join wrapped Markdown lines into a single Word paragraph.
        pieces = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(("#", "> ", "|", "```", "<!-- PAGE BREAK -->")) and not re.match(r"^\s*(?:[-*] |\d+\. )", lines[i]):
            pieces.append(lines[i].strip())
            i += 1
        blocks.append(paragraph(" ".join(pieces)))
    return "".join(blocks)


STYLES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="20"/><w:color w:val="26382F"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="130" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="174B35"/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="100" w:after="70"/></w:pPr><w:rPr><w:b/><w:color w:val="176B47"/><w:sz w:val="27"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="75" w:after="50"/></w:pPr><w:rPr><w:b/><w:color w:val="176B47"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="240" w:right="180"/><w:spacing w:before="60" w:after="100"/></w:pPr><w:rPr><w:i/><w:color w:val="805B15"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListText"><w:name w:val="List Text"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="300"/><w:spacing w:after="55"/></w:pPr></w:style>
</w:styles>'''


def main():
    content = parse_markdown(SOURCE.read_text(encoding="utf-8"))
    footer = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>{run("AAROGYA-DRISHTI  •  PROJECT REPORT  |  ")}<w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>'''
    document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{content}<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="1020" w:bottom="900" w:left="1020" w:header="400" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>'''
    rels = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'''
    types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'''
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", types)
        archive.writestr("_rels/.rels", root_rels)
        archive.writestr("word/document.xml", document)
        archive.writestr("word/styles.xml", STYLES)
        archive.writestr("word/_rels/document.xml.rels", rels)
        archive.writestr("word/footer1.xml", footer)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
