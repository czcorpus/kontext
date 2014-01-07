/*
 * Copyright (c) 2003-2009 Pavel Rychly
 * Copyright (c) 2014 Institute of the Czech National Corpus
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

define(['jquery', 'win'], function ($, win) {
    'use strict';

    var lib = {},
        normalize_element,
        replace_tags,
        remove_tags,
        gen_xml,
        conc_cup,
        conc_anw_inl,
        conc_oec_oup_all;

    /**
     * makes the 'B' element lowercase, removes the '===NONE===' string
     * within specified element's innerHTML
     *
     * @param {string} id
     * @returns {string}
     */
    normalize_element = function (id) {
        var text = win.document.getElementById(id).innerHTML;
        return text.replace("<B>", "<b>").replace("</B>", "</b>").replace(/\===NONE===/g, "");
    };

    /**
     * Replaces the 'B' element by a specified name (parameter 'tag') plus removes the '===NONE===' strings
     * within a specified element's innerHTML
     *
     * @param {string} id
     * @param {string} tag
     * @returns {string}
     */
    replace_tags = function (id, tag) {
        var text = win.document.getElementById(id).innerHTML;

        if (win.document.getElementById(id) === null) {
            return '';
        }
        return text.replace("<B>", "<" + tag + ">").replace("</B>", "</" + tag + ">").replace("<b>", "<" + tag + ">")
            .replace("</b>", "</" + tag + ">").replace(/\===NONE===/g, "");
    };

    /**
     * Removes any 'B', 'b' elements plus '===NONE===' strings
     * within a specified element's innerHTML
     *
     * @param {string} id
     * @returns {string}
     */
    remove_tags = function (id) {
        var text = win.document.getElementById(id).innerHTML;

        if (win.document.getElementById(id) === null) {
            return '';
        }
        return text.replace("<B>", "").replace("</B>", "").replace("<b>", "").replace("</b>", "")
            .replace(/\===NONE===/g, "");
    };

    /**
     *
     * @param id
     * @param template
     * @returns {*}
     */
    gen_xml = function (id, template) {
        var xml;

        if (template === 'ANW_INL') {
            xml = conc_anw_inl(id);
        } else if (template === 'cupclc') {
            xml = conc_cup(id, 6);
        } else if (template === 'cupcic') {
            xml = conc_cup(id, 5);
        } else if (template === 'cupcsc') {
            xml = conc_cup(id, 4);
        } else if (template === 'cupcac') {
            xml = conc_cup(id, 5);
        } else if (template === 'fidaplus_slovene') {
            xml = replace_tags('sent' + id, 'i') + '\n';
        } else if (template === 'oec_oup_all') {
            xml = conc_oec_oup_all(id);
        } else {
            xml = normalize_element('sent' + id) + '\n';
        }
        return xml;
    };

    /**
     *
     * @param {string} id
     * @param {number} num
     * @returns {string}
     */
    conc_cup = function (id, num) {
        var xml,
            j;

        xml = remove_tags('sent' + id).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        xml += ' (';
        for (j = 0; j < num; j += 1) {
            xml += remove_tags('ref' + id + '-' + j) + '; ';
        }
        xml += remove_tags('ref' + id + '-' + num) + ')\n';
        return xml;
    };

    /**
     *
     * @param {string|number} id
     * @returns {string}
     */
    conc_anw_inl = function (id) {
        var xml = '<Voorbeeld>\n';

        xml += '  <tekst>' + remove_tags('sent' + id) + '</tekst>\n';
        xml += '  <id>' + remove_tags('ref' + id + '-0') + '</id>\n';
        xml += '  <bronentitel>' + remove_tags('ref' + id + '-1') + '</bronentitel>\n';
        xml += '  <datering>' + remove_tags('ref' + id + '-2') + '</datering>\n';
        xml += '  <variant>' + remove_tags('ref' + id + '-3') + '</variant>\n';
        xml += '  <auteur>' + remove_tags('ref' + id + '-4') + '</auteur>\n';
        xml += '  <url>' + remove_tags('ref' + id + '-5') + '</url>\n';
        xml += '</Voorbeeld>\n';
        return xml;
    };

    /**
     *
     * @param {string|number} id
     * @returns {string}
     */
    conc_oec_oup_all = function (id) {
        var xml = 'sentence=' + normalize_element('sent' + id) + '\n';

        xml += remove_tags('ref' + id + '-0') + '\n';
        xml += remove_tags('ref' + id + '-1') + '\n';
        xml += remove_tags('ref' + id + '-2') + '\n';
        xml += remove_tags('ref' + id + '-3') + '\n';
        xml += remove_tags('ref' + id + '-4') + '\n';
        xml += remove_tags('ref' + id + '-5') + '\n';
        xml += remove_tags('ref' + id + '-6') + '\n';
        xml += remove_tags('ref' + id + '-7') + '\n';
        xml += remove_tags('ref' + id + '-8') + '\n';
        xml += remove_tags('ref' + id + '-9') + '\n\n';
        return xml;
    };

/*******************************************
 ****** tickbox lexicography functions *****
 *******************************************/

    /**
     *
     * @param template
     * @param lemma
     * @param gramrel
     * @returns {string}
     */
    lib.tblex2xml = function (template, lemma, gramrel) {
        var xml = '';

        if (template === 'vanilla' || template === 'vanilla2') {
            xml = lib.vanilla(lemma, gramrel);
        } else if (template === 'ukwac_mcd') {
            xml = lib.ukwac_mcd(lemma, gramrel);
        } else if (template === 'oec_oup_shogakukan') {
            xml = lib.oec_oup_shogakukan();
        } else if (template === 'ANW_INL') {
            xml = lib.anw_inl(lemma, gramrel);
        } else if (template === 'fidaplus_slovene') {
            xml = lib.fidaplus_slovene(lemma, gramrel);
        } else if (template === 'iztok_caja') {
            xml = lib.iztok_caja(lemma, gramrel);
        } else if (template === 'cupclc') {
            xml = lib.cup(6);
        } else if (template === 'cupcic') {
            xml = lib.cup(5);
        } else if (template === 'cupcsc') {
            xml = lib.cup(4);
        } else if (template === 'cupcac') {
            xml = lib.cup(5);
        } else if (template === 'bnc_test') {
            xml = lib.bnc_test();
        } else if (template === 'bnc-1m_neco_neco') {
            xml = lib.bnc_test();
        } else if (template === 'oec_oup_all') {
            xml = lib.oec_oup_all();
        } else {
            $('#copy_note').text('ERROR');
        }
        $('#copy_note').text('XML copied');
        return xml;
    };

    /**
     *
     * @param lemma
     * @param gramrel
     * @returns {string}
     */
    lib.anw_inl = function (lemma, gramrel) {
        var xml = '<keyword>' + lemma + '</keyword>\n<gramrel>\n  <grname>' + gramrel + '</grname>\n',
            curr_collo = '',
            i = 1,
            chbox = win.document.getElementById(i.toString());

        while (chbox !== null) {
            if (chbox.checked) { // costruction of xml
                if (curr_collo !== chbox.name) {
                    if (curr_collo !== '') {
                        xml += '  </collocation>\n';
                    }
                    xml += '  <collocation>\n    <collo>' + chbox.name + '</collo>\n';
                }
                xml += '    <Voorbeeld>\n';
                xml += '      <tekst>' + remove_tags('sent' + i) + '</tekst>\n';
                xml += '      <id>' + remove_tags('ref' + i + '-0');
                xml += '</id>\n';
                xml += '      <bronentitel>' + remove_tags('ref' + i + '-1');
                xml += '</bronentitel>\n';
                xml += '      <datering>' + remove_tags('ref' + i + '-2');
                xml += '</datering>\n';
                xml += '      <variant>' + remove_tags('ref' + i + '-3');
                xml += '</variant>\n';
                xml += '      <auteur>' + remove_tags('ref' + i + '-4');
                xml += '</auteur>\n';
                xml += '      <url>' + remove_tags('ref' + i + '-5') + '</url>\n';
                xml += '    </Voorbeeld>\n';
                curr_collo = chbox.name;
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        if (curr_collo !== '') {
            xml += '  </collocation>\n';
        }
        xml += '</gramrel>\n';
        return xml;
    };

    /**
     *
     * @param lemma
     * @param gramrel
     * @returns {string}
     */
    lib.vanilla = function (lemma, gramrel) {
        var xml = '<keyword>' + lemma + '</keyword>\n<gramrel>\n  <grname>' + gramrel + '</grname>\n',
            curr_collo = '',
            i = 1,
            chbox = win.document.getElementById(i.toString());

        while (chbox !== null) {
            if (chbox.checked) {
                if (curr_collo !== chbox.name) {
                    if (curr_collo !== '') {
                        xml += '  </collocation>\n';
                    }
                    xml += '  <collocation>\n    <collo>' + chbox.name + '</collo>\n';
                }
                xml += '    <example>' + normalize_element('sent' + i) + '</example>\n';
                curr_collo = chbox.name;
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        if (curr_collo !== '') {
            xml += '  </collocation>\n';
        }
        xml += '</gramrel>\n';
        return xml;
    };

    /**
     *
     * @param lemma
     * @param gramrel
     * @returns {string}
     */
    lib.iztok_caja = function (lemma, gramrel) {
        //  xml = '<keyword>' + lemma + '</keyword>\n<gramrel>\n  <grname>'
        //        + gramrel + '</grname>\n';
        var xml = '<Dictionary>\n  <Language>\n  <Headword HeadwordSign="' + lemma
                + '">\n  <gramrel grname="' + gramrel + '">\n',
            curr_collo = '',
            i = 1,
            chbox = win.document.getElementById(i.toString()),
            index;

        while (chbox !== null) {
            if (chbox.checked) { // costruction of xml
                if (curr_collo !== chbox.name) {
                    if (curr_collo !== '') {
                        xml += '  </collocation>\n';
                    }
                    xml += '  <collocation collo="' + chbox.name + '">\n';
                    index = 0;
                }
                index += 1;
                xml += '    <Example Example.number="';
                xml += index + '" Database.DomainLabel="';
                xml += remove_tags('ref' + i + '-0') + '" Example="';
                xml += remove_tags('sent' + i) + '" Source="';
                xml += remove_tags('ref' + i + '-1') + '" />\n';
                curr_collo = chbox.name;
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        if (curr_collo !== '') {
            xml += '  </collocation>\n';
        }
        xml += '  </gramrel>\n  </Headword>\n  </Language>\n</Dictionary>\n';
        return xml;
    };

    /**
     *
     * @param lemma
     * @param gramrel
     * @returns {string}
     */
    lib.ukwac_mcd = function (lemma, gramrel) {
        var xml = '<keyword>' + lemma + '</keyword>\n<gramrel>\n  <grname>' + gramrel + '</grname>\n',
            curr_collo = '',
            i = 1,
            chbox = win.document.getElementById(i.toString());

        while (chbox !== null) {
            if (curr_collo !== chbox.name) {
                if (curr_collo !== '') {
                    xml += '  </collocation>\n';
                }
                xml += '  <collocation>\n    <collo>' + chbox.name + '</collo>\n';
            }
            if (chbox.checked) {
                xml += '    <example>' + normalize_element('sent' + i) + '</example>\n';
            }
            curr_collo = chbox.name;
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        if (curr_collo !== '') {
            xml += '  </collocation>\n';
        }
        xml += '</gramrel>\n';
        return xml;
    };

    /**
     *
     * @returns {string}
     */
    lib.oec_oup_shogakukan = function () {
        var xml = '',
            i = 1,
            chbox = win.document.getElementById(i.toString());

        while (chbox !== null) {
            if (chbox.checked) {
                xml += '<eg xmlns:e="urn:IDMEE" xmlns="urn:M-EN_US-MSDICT"><ex prov="';
                xml += remove_tags('ref' + i + '-0') + '" source="';
                xml += remove_tags('ref' + i + '-1') + '">';
                xml += remove_tags('sent' + i);
                xml += '</ex></eg>\n';
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        return xml;
    };

    /**
     *
     * @returns {string}
     */
    lib.fidaplus_slovene = function () {
        var xml = '',
            i = 1,
            chbox = win.document.getElementById(i.toString());

        while (chbox !== null) {
            if (chbox.checked) {
                xml += '<zgled>';
                xml += replace_tags('sent' + i, 'i');
                xml += '</zgled>';
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        return xml;
    };

    /**
     *
     * @returns {string}
     */
    lib.oec_oup_all = function () {
        var xml = '',
            id = 1,
            chbox = win.document.getElementById(id.toString());

        while (chbox !== null) {
            if (chbox.checked) {
                xml += 'sentence=' + normalize_element('sent' + id) + '\n';
                xml += remove_tags('ref' + id + '-0') + '\n';
                xml += remove_tags('ref' + id + '-1') + '\n';
                xml += remove_tags('ref' + id + '-2') + '\n';
                xml += remove_tags('ref' + id + '-3') + '\n';
                xml += remove_tags('ref' + id + '-4') + '\n';
                xml += remove_tags('ref' + id + '-5') + '\n';
                xml += remove_tags('ref' + id + '-6') + '\n';
                xml += remove_tags('ref' + id + '-7') + '\n';
                xml += remove_tags('ref' + id + '-8') + '\n';
                xml += remove_tags('ref' + id + '-9') + '\n\n';
            }
            id += 1;
            chbox = win.document.getElementById(id.toString());
        }
        return xml;
    };

    /**
     *
     * @param num
     * @returns {string}
     */
    lib.cup = function (num) {
        var xml = '',
            i = 1,
            chbox = win.document.getElementById(i.toString()),
            j;

        while (chbox !== null) {
            if (chbox.checked) {
                xml += remove_tags('sent' + i).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                xml += ' (';
                for (j = 0; j < num; j += 1) {
                    xml += remove_tags('ref' + i + '-' + j) + '; ';
                }
                xml += remove_tags('ref' + i + '-' + num) + ')\n';
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        return xml;
    };

    /**
     *
     * @returns {string}
     */
    lib.bnc_test = function () {
        var xml = '',
            i = 1,
            chbox = win.document.getElementById(i.toString());

        while (chbox !== null) {
            if (chbox.checked) {
                xml += '<eg xmlns:e="urn:IDMEE" xmlns="urn:M-EN_US-MSDICT"><ex prov="';
                xml += remove_tags('ref' + i + '-0') + '" source="';
                xml += remove_tags('ref' + i + '-1') + '">';
                xml += remove_tags('sent' + i);
                xml += '</ex></eg>\n';
            }
            i += 1;
            chbox = win.document.getElementById(i.toString());
        }
        return xml;
    };

    return lib;
});

