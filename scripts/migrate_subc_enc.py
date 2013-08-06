# -*- coding: utf-8 -*-
import sys
import os
import shutil
import datetime
import time

corp_enc = {
    'capek_fr': 'iso8859-2',
    'capek_uplny': 'iso8859-2',
    'intercorp_hr': 'utf8',
    'orwell': 'iso8859-2',
    'bmk': 'iso8859-2',
    'intercorp_de': 'utf8',
    'syn2009pub': 'iso8859-2',
    'intercorp_lv': 'utf8',
    'dewac': 'utf8',
    'pmk_kr': 'iso8859-2',
    'link': 'iso8859-2',
    'skript2012': 'iso8859-2',
    'hrabal_fr': 'iso8859-2',
    'bnc': 'iso8859-1',
    'intercorp_ro': 'utf8',
    'intercorp_it': 'utf8',
    'intercorp_hu': 'utf8',
    'orig_syn_wsbr': 'iso8859-2',
    'intercorp_ca': 'utf8',
    'diakorp': 'iso8859-2',
    'ksk-dopisy': 'iso8859-2',
    'intercorp_mt': 'utf8',
    'pmk_kr_dl': 'iso8859-2',
    'trans': 'iso8859-2',
    'syn2010': 'iso8859-2',
    'intercorp_sr': 'utf8',
    'totalita': 'iso8859-2',
    'hrabal': 'iso8859-2',
    'cizojaz_it': 'iso8859-1',
    'intercorp_cs': 'utf8',
    'intercorp_lt': 'utf8',
    'pribehy': 'iso8859-2',
    'oral2013': 'iso8859-2',
    'intercorp_en': 'utf8',
    'diakon': 'iso8859-2',
    'pmk': 'iso8859-2',
    'intercorp_hi': 'utf8',
    'intercorp_uk': 'utf8',
    'intercorp_sk': 'utf8',
    'orw-mte': 'iso8859-2',
    'syn2005fon': 'iso8859-2',
    'intercorp_et': 'utf8',
    'orig_syn': 'iso8859-2',
    'intercorp_es': 'utf8',
    'capek': 'iso8859-2',
    'oral': 'iso8859-2',
    'dotko': 'utf8',
    'czesl-plain': 'iso8859-2',
    'deaf': 'iso8859-2',
    'intercorp_sy': 'utf8',
    'intercorp_ar': 'utf8',
    'cizojaz_fr': 'iso8859-1',
    'intercorp_pl': 'utf8',
    'banatdop': 'iso8859-2',
    'intercorp_da': 'utf8',
    'susanne': 'iso8859-1',
    'frwac': 'utf8',
    'banat': 'iso8859-2',
    'syn2006pub': 'iso8859-2',
    'intercorp_sl': 'utf8',
    'intercorp_fr': 'utf8',
    'intercorp_el': 'utf8',
    'capek_syl': 'iso8859-2',
    'capek_fr': 'iso8859-2',
    'capek_uplny': 'iso8859-2',
    'orwell': 'iso8859-2',
    'bmk': 'iso8859-2',
    'intercorp_de': 'utf8',
    'syn2009pub': 'iso8859-2',
    'intercorp_lv': 'utf8',
    'dewac': 'utf8',
    'pmk_kr': 'iso8859-2',
    'link': 'iso8859-2',
    'skript2012': 'iso8859-2',
    'hrabal_fr': 'iso8859-2',
    'intercorp_ro': 'utf8',
    'intercorp_it': 'utf8',
    'intercorp_hu': 'utf8',
    'orig_syn_wsbr': 'iso8859-2',
    'diakorp': 'iso8859-2',
    'ksk-dopisy': 'iso8859-2',
    'intercorp_mt': 'utf8',
    'pmk_kr_dl': 'iso8859-2',
    'syn2010': 'iso8859-2',
    'totalita': 'iso8859-2',
    'hrabal': 'iso8859-2',
    'cizojaz_it': 'iso8859-1',
    'intercorp_cs': 'utf8',
    'intercorp_lt': 'utf8',
    'oral2013': 'iso8859-2',
    'intercorp_en': 'utf8',
    'diakon': 'iso8859-2',
    'pmk': 'iso8859-2',
    'intercorp_sk': 'utf8',
    'orw-mte': 'iso8859-2',
    'syn2005fon': 'iso8859-2',
    'intercorp_et': 'utf8',
    'orig_syn': 'iso8859-2',
    'intercorp_es': 'utf8',
    'capek': 'iso8859-2',
    'oral': 'iso8859-2',
    'dotko': 'utf8',
    'czesl-plain': 'iso8859-2',
    'deaf': 'iso8859-2',
    'cizojaz_fr': 'iso8859-1',
    'intercorp_pl': 'utf8',
    'banatdop': 'iso8859-2',
    'intercorp_da': 'utf8',
    'frwac': 'utf8',
    'banat': 'iso8859-2',
    'syn2006pub': 'iso8859-2',
    'intercorp_sl': 'utf8',
    'intercorp_fr': 'utf8',
    'intercorp_el': 'utf8',
    'cizojaz_de': 'iso8859-1',
    'intercorp_sv': 'utf8',
    'intercorp_bg': 'utf8',
    'intercorp_fi': 'utf8',
    'schola2010': 'iso8859-2',
    'syn2005wsbr': 'iso8859-2',
    'pmk_dl': 'iso8859-2',
    'syn2005': 'iso8859-2',
    'ukwac': 'utf8',
    'intercorp_nl': 'utf8',
    'itwac': 'utf8',
    'oral2008': 'iso8859-2',
    'fdcc': 'iso8859-2',
    'syn2000': 'iso8859-2',
    'intercorp_pt': 'utf8',
    'syn': 'iso8859-2',
    'fsc2000': 'iso8859-2',
    'oral2006': 'iso8859-2',
    'hotko': 'utf8',
    'intercorp_mk': 'utf8',
    'cizojaz_de': 'iso8859-1',
    'intercorp_sv': 'utf8',
    'intercorp_bg': 'utf8',
    'intercorp_fi': 'utf8',
    'schola2010': 'iso8859-2',
    'syn2005wsbr': 'iso8859-2',
    'pmk_dl': 'iso8859-2',
    'intercorp_ru': 'utf8',
    'syn2005': 'iso8859-2',
    'ukwac': 'utf8',
    'bnc_old': 'iso8859-1',
    'parole': 'iso8859-1',
    'intercorp_nl': 'utf8',
    'itwac': 'utf8',
    'oral2008': 'iso8859-2',
    'fdcc': 'iso8859-2',
    'syn2000': 'iso8859-2',
    'intercorp_pt': 'utf8',
    'intercorp_no': 'utf8',
    'intercorp_be': 'utf8',
    'syn': 'iso8859-2',
    'fsc2000': 'iso8859-2',
    'oral2006': 'iso8859-2',
    'vera': 'iso8859-2',
    'hotko': 'utf8',
}


def scan_directory(path):
    ans = []
    for item in os.listdir(path):
        abs_path = '%s/%s' % (path, item)
        if os.path.isfile(abs_path):
            ans.append(abs_path)
        elif os.path.isdir(abs_path):
            ans += scan_directory(abs_path)
    return ans


def get_corp_name_from_path(path, root_path):
    data = path[len(root_path) + 1:].split('/')
    if len(data) < 4:
        data.insert(1, '')
    return tuple(data)

if __name__ == '__main__':
    path_list = scan_directory(sys.argv[1])
    for path in path_list:
        bonito_update_date = datetime.datetime.now() - datetime.timedelta(minutes=4 * 24 * 60) \
            + datetime.timedelta(minutes=253)
        bonito_update_date = time.mktime(bonito_update_date.timetuple())
        printable_file_date = ' (%s)' % datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M:%S')
        if path.endswith('.py'):
            continue
        if os.path.getmtime(path) > bonito_update_date:
            sys.stdout.write('>>> ignored file ')
            sys.stdout.write(path)
            print(printable_file_date)
            continue
        user_name, limit, corp_name, subcorp_name = get_corp_name_from_path(path, sys.argv[1])
        if corp_name in corp_enc:
            if corp_enc[corp_name] == 'iso8859-2':
                n = subcorp_name.decode('iso-8859-2')
                old_path = path.replace('//', '/')
                path1 = old_path + '.old'

                path2 = ('/'.join((sys.argv[1], user_name, limit, corp_name, n))).replace('//', '/')
                #print(old_path)
                #print(path1)
                shutil.move(old_path, path1)
                #print(path2)
                print('converted file %s %s ' % (old_path, printable_file_date))
                #print('------------')
                shutil.copyfile(path1, path2)
        else:
            print('Failed to fix subcorpus [%s] (user = %s, corpus = %s)' % (subcorp_name, user_name, corp_name))
