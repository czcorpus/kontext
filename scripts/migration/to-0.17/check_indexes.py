import argparse
import logging
import os
import re

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Find missing indexes')
    parser.add_argument('registry_path', type=str, help='Path to registry files')
    args = parser.parse_args()

    generate_files = []
    for file in os.listdir(args.registry_path):
        full_registry_path = os.path.join(args.registry_path, file)
        with open(full_registry_path) as f:
            for line in f:
                corpus_path = re.search(r'^PATH[\s\t]+\"?([^\"]*)\"?[\s\t]+', line)
                if corpus_path:
                    if not os.path.isdir(corpus_path.group(1)):
                        logging.error(f'"{corpus_path.group(1)}" not found for registry "{file}"')
                        break
                    token_exists = False
                    for corp_file in os.listdir(corpus_path.group(1)):
                        if corp_file.endswith('.token'):
                            token_exists = True
                            break

                    if not token_exists:
                        generate_files.append(full_registry_path)
                    break

    for gen in generate_files:
        print(f'corpus4fsa {gen}')
