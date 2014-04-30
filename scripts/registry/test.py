import sys
from parser import reg_grammarParser

if __name__ == '__main__':
    import confparsing

    if len(sys.argv) < 3:
        print('A registry file and character encoding must be specified')
        sys.exit(1)

    filename = sys.argv[1]
    startrule = 'conf'

    with open(filename) as f:
        text = f.read().decode(sys.argv[2]).encode('utf-8').decode('ascii', 'ignore')
    parser = reg_grammarParser(parseinfo=False)
    ast = parser.parse(
        text,
        startrule,
        filename=filename,
        semantics=confparsing.ConfigSemantics())
    tree_walker = confparsing.TreeWalker(ast)
    ans = tree_walker.run()
    print(ans.get_structattrs())
