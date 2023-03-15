# Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

from typing import List
import aiofiles
import aiocsv
import csv
import ujson
from plugins.masm_live_attributes.doclist import DocListItem
from templating import Type2XML


async def export_csv(data: List[DocListItem], target_path: str) -> bool:
    if len(data) == 0:
        return False
    hd = list(data[0].attrs.keys())
    async with aiofiles.open(target_path, 'w') as fw:
        csv_writer = aiocsv.AsyncWriter(fw, quoting=csv.QUOTE_ALL, delimiter=';')
        await csv_writer.writerow(hd)
        for item in data:
            await csv_writer.writerow([item.attrs[k] for k in hd])
        return True

async def export_xml(data: List[DocListItem], target_path: str) -> bool:
    if len(data) == 0:
        return False
    async with aiofiles.open(target_path, 'w') as fw:
        await fw.write(Type2XML.to_xml(data))
        return True

async def export_jsonl(data: List[DocListItem], target_path: str) -> bool:
    if len(data) == 0:
        return False
    async with aiofiles.open(target_path, 'w') as fw:
        for item in data:
            await fw.write(ujson.dumps(item.to_dict()) + "\n")
        return True