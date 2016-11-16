/*
 * Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../types/common.d.ts" />

import {PageModel, PluginApi} from './document';
import * as $ from 'jquery';
import {create as createCorparch} from 'plugins/corparch/init';
import {bind as bindPopupBox} from '../popupbox';

/**
 *
 */
class WordlistFormPage implements Kontext.QuerySetupHandler {

    private layoutModel:PageModel

    private corplistComponent; // TODO

    private onSubcorpChangeActions:Array<(subcname:string)=>void> = [];

    constructor(layoutModel:PageModel) {
        this.layoutModel = layoutModel;
    }

    registerOnAddParallelCorpAction(fn:(corpname:string)=>void):void {}

    registerOnBeforeRemoveParallelCorpAction(fn:(corpname:string)=>void) {}

    registerOnRemoveParallelCorpAction(fn:(corpname:string)=>void):void {}

    /**
     * Registers a callback which is invoked after the subcorpus
     * selection element is changed. It guarantees that all the
     * firstForm's internal actions are performed before this
     * externally registered ones.
     *
     * @param fn:(subcname:string)=>void
     */
    registerOnSubcorpChangeAction(fn:(subcname:string)=>void):void {
        this.onSubcorpChangeActions.push(fn);
    }


    private updForm(item) {
        let formAncestor;
        const ancestors = $(item.target).parents();

        for (let i = 0; i < ancestors.length; i += 1) {
            if (ancestors[i].nodeName === 'FORM') {
                formAncestor = ancestors[i];
                break;
            }
        }
        if (formAncestor !== undefined) {
            let srch;
            srch = $(formAncestor).find('*[name="reload"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '1');
            }
            srch = $(formAncestor).find('*[name="usesubcorp"]');
            if (srch.length > 0) {
                $(srch[0]).attr('value', '');
            }
            formAncestor.submit();
        }
    }

    /**
     *
     */
    selectOutputType(forceType?:string):void {
        const wltypes = ['wltype_simple', 'wltype_keywords', 'wltype_multilevel'];
        const kwinputs = ['ref_corpname', 'ref_usesubcorp', 'simple_n'];
        const mlinputs = ['wlposattr1', 'wlposattr2', 'wlposattr3'];
        let type;

        if (forceType === undefined) {
            for (let i = 0; i < wltypes.length; i += 1) {
                if ($(window.document.getElementById(wltypes[i])).is(':checked')) {
                    type = wltypes[i].split('_')[1];
                }
            }

        } else {
            type = forceType;
        }

        if (type === 'simple') {
            $('#wordlist_form').attr('action', 'wordlist');
            for (let i = 0; i < kwinputs.length; i += 1) {
                $(window.document.getElementById(kwinputs[i])).prop('disabled', true);
            }
            for (let i = 0; i < mlinputs.length; i += 1) {
                $(window.document.getElementById(mlinputs[i])).prop('disabled', true);
            }

        } else if (type === 'keywords') {
            $(window.document.getElementById('wordlist_form')).attr('action', 'wordlist');
            for (let i = 0; i < kwinputs.length; i += 1) {
                $(window.document.getElementById(kwinputs[i])).prop('disabled', false);
            }
            for (let i = 0; i < mlinputs.length; i += 1) {
                $(window.document.getElementById(mlinputs[i])).prop('disabled', true);
            }

        } else if (type === 'multilevel') {
            $(window.document.getElementById('wordlist_form')).attr('action', 'struct_wordlist');
            for (let i = 0; i < kwinputs.length; i += 1) {
                $(window.document.getElementById(kwinputs[i])).prop('disabled', true);
            }
            for (let i = 0; i < mlinputs.length; i += 1) {
                $(window.document.getElementById(mlinputs[i])).prop('disabled', false);
            }
        }
    }

    /**
     *
     */
    bindStaticElements():void {
        bindPopupBox(
            $('#show-help-format-link'),
            this.layoutModel.translate('global__wl_white_lists'),
            {
                width: '300px'
            }
        );
        $('#select-output-type-simple').on('click', () => {
            this.selectOutputType('simple');
        });
        $('#select-output-type-keywords').on('click', () => {
            this.selectOutputType('keywords');
        });
        $('#select-output-type-multilevel').on('click', () => {
            this.selectOutputType('multilevel');
        });
    }


    registerSubcorpChange():void {
        $('#subcorp-selector').on('change', (e) => {
            // following code must be always the last action performed on the event
            this.onSubcorpChangeActions.forEach(fn => {
                fn.call(this, $(e.currentTarget).val());
            });
        });
    }


    initOutputTypeForms():void {
        const form = $('#wordlist_form');
        const dynamicElements = form.find('select.wlposattr-sel');
        const hint = form.find('p.hint');
        const radioSel = form.find('.wltype-sel');
        const wlAttrSel = form.find('select.wlattr-sel');
        const currWlattrDisp = form.find('.current-wlattr');

        function setFormElementsVisibility(status) {
            if (status === true) {
                dynamicElements.prop('disabled', false);
                hint.show();

            } else {
                dynamicElements.prop('disabled', true);
                hint.hide();
            }
        }

        $('.output-types input.wltype-sel').on('change', (evt) => {
            const ansType = $(evt.target).val();

            if (ansType === 'simple') {
                setFormElementsVisibility(false);
                form.attr('action', this.layoutModel.createActionUrl('wordlist'));

            } else if (ansType === 'multilevel') {
                setFormElementsVisibility(true);
                form.attr('action', this.layoutModel.createActionUrl('struct_wordlist'));
            }
        });

        if (radioSel.val() === 'simple') {
            setFormElementsVisibility(false);
        }

        wlAttrSel.on('change', () => {
            currWlattrDisp.text(wlAttrSel.find('option:selected').text());
        });

        currWlattrDisp.text(wlAttrSel.find('option:selected').text());
    }



    init():void {
        this.layoutModel.init().then(
            (d) => {
                this.bindStaticElements();
                this.corplistComponent = createCorparch(
                        $('form[id="wordlist_form"] select[name="corpname"]').get(0),
                        'wordlist_form',
                        this.layoutModel.pluginApi(),
                        this,
                        {formTarget: 'wordlist_form', submitMethod: 'GET'}
                ),
                this.registerSubcorpChange();
                this.initOutputTypeForms();
            }
        )
    }
}


export function init(conf:Kontext.Conf) {
    const model = new WordlistFormPage(new PageModel(conf));
    model.init();
}