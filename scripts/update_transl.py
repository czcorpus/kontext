# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>

import sys
import argparse
import json

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Translation updater')
    parser.add_argument('updated_file', type=str, help='a path to updated translations json file')
    parser.add_argument('template_file', type=str, help='a path to translations template json file')
    parser.add_argument('--dry-run', dest='dry_run', action='store_true',
                        default=False, help='print differences, no editting')
    args = parser.parse_args()

    with open(args.updated_file) as f1, open(args.template_file) as f2:
        updated = json.load(f1)
        template = json.load(f2)

    if len(updated.keys()) == 1 and len(template.keys()) == 1:
        updated_lang, updated_data = list(updated.items())[0]
        template_lang, template_data = list(template.items())[0]
    else:
        raise Exception(
            'Unclear language codes, every file has to contain only one language section')

    common_keys = set(updated_data.keys()).intersection(template_data.keys())
    missing_keys = set(template_data.keys()).difference(common_keys)
    excessive_keys = set(updated_data.keys()).difference(common_keys)

    if args.dry_run:
        if missing_keys:
            print(f'Missing keys are: {missing_keys}')
        if excessive_keys:
            print(f'Excessive keys are: {excessive_keys}')
        if not missing_keys and not excessive_keys:
            print('No difference found')
    else:
        print('Processing...')
        updated_data = {k: v for k, v in updated_data.items() if k not in excessive_keys}
        updated_data.update({k: f'{v} UNTRANSLATED' for k,
                             v in template_data.items() if k in missing_keys})
        with open(args.updated_file, 'w') as f:
            json.dump({updated_lang: updated_data}, f, indent=4, ensure_ascii=False)
        print('Done')
