# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>

import sys
import argparse
import json

UNTRANSLATED_SUFFIX = 'UNTRANSLATED'


def process_data(updated_data, template_data, dry_run):
    common_keys = set(updated_data.keys()).intersection(template_data.keys())
    missing_keys = set(template_data.keys()).difference(common_keys)
    excessive_keys = set(updated_data.keys()).difference(common_keys)

    if dry_run:
        if missing_keys:
            print(f'Missing keys are: {missing_keys}')
        if excessive_keys:
            print(f'Excessive keys are: {excessive_keys}')
        if not missing_keys and not excessive_keys:
            print('No difference found')
        sys.exit(0)
    else:
        print('Processing...')
        updated_data = {k: v for k, v in updated_data.items() if k not in excessive_keys}
        updated_data.update({k: f'{v} {UNTRANSLATED_SUFFIX}' for k,
                             v in template_data.items() if k in missing_keys})
        return updated_data, missing_keys, excessive_keys


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Translation updater')
    parser.add_argument('updated_file', type=str,
                        help='a path to updated translations json/po file')
    parser.add_argument('template_file', type=str,
                        help='a path to translations template json/po file')
    parser.add_argument('--dry-run', dest='dry_run', action='store_true',
                        default=False, help='print differences, no editting')
    args = parser.parse_args()

    if args.updated_file.endswith('.json') and args.template_file.endswith('.json'):
        with open(args.updated_file) as f1, open(args.template_file) as f2:
            updated = json.load(f1)
            template = json.load(f2)

        if len(updated.keys()) == 1 and len(template.keys()) == 1:
            updated_lang, updated_data = list(updated.items())[0]
            template_lang, template_data = list(template.items())[0]
        else:
            raise Exception(
                'Unclear language codes, every file has to contain only one language section')

        updated_data, _, _ = process_data(updated_data, template_data, args.dry_run)

        with open(args.updated_file, 'w') as f:
            json.dump({updated_lang: updated_data}, f, indent=4, ensure_ascii=False)
        print('Done')

    elif args.updated_file.endswith('.po') and args.template_file.endswith('.po'):
        try:
            import polib
        except:
            print('Missing `polib` package. Please install it.')
            sys.exit(1)

        updated_file = polib.pofile(args.updated_file)
        template_file = polib.pofile(args.template_file)

        updated_data = {item.msgid: item.msgstr for item in updated_file}
        template_data = {item.msgid: item.msgstr for item in template_file}

        _, missing_keys, excessive_keys = process_data(updated_data, template_data, args.dry_run)
        for exc in excessive_keys:
            updated_file.remove(updated_file.find(exc))
        for miss in missing_keys:
            updated_file.append(polib.POEntry(
                msgid=miss,
                msgstr=f'{miss} {UNTRANSLATED_SUFFIX}'
            ))
        updated_file.save(args.updated_file)
        print('Done')

    else:
        print('Unknown translation files. Both have to be `.json` or `.po`.')
        sys.exit(1)
