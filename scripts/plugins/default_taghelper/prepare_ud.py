import sys
import pickle


def parse_word_line(line):
    ''' parses word line to get POS and features '''

    line_parts = line.split('\t', 5)
    pos, feature = line_parts[3: 5]
    data = [
        tuple(k_v.split('='))
        for k_v in feature.split('|')
        if k_v != '_'  # `_` denotes absence according to Universal Dependencies
    ]
    data.append(('POS', pos))

    # check multiple keys of the same kind
    if len([x[0] for x in data]) > len(set(x[0] for x in data)):
        print('multiple keys in {}'.format(data))

    # return tuple of tuples (key, value) sorted by key
    return tuple(sorted(data, key=lambda x: x[0]))


def load_variations(src_path):
    # prepare all variations from vertical data
    variations = set()
    with open(src_path, 'r') as f:
        for line in f:
            if line.strip().startswith('<'):  # skip lines with xml tags
                continue
            variations.add(parse_word_line(line))
    return list(variations)


if __name__ == '__main__':
    try:
        src_path = sys.argv[1] if len(sys.argv) > 1 else 'vertikala_pdt'
        dest_path = sys.argv[2] if len(sys.argv) > 1 else 'tags_pdt'
    except KeyError:
        sys.exit('Missing source or destination file')

    print('Loading resource from {}...'.format(src_path))
    variations = load_variations(src_path)
    with open(dest_path, 'w') as f:
        pickle.dump(variations, f, protocol=2)
    print('...saved to {} ({} items)'.format(dest_path, len(variations)))
