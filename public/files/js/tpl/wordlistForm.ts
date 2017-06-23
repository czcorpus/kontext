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
/// <reference path="../../ts/declarations/immutable.d.ts" />

import {PageModel, PluginApi} from './document';
import * as $ from 'jquery';
import {createWidget as createCorparch} from 'plugins/corparch/init';
import * as Immutable from 'vendor/immutable';
import {init as wordlistFormInit, WordlistFormViews} from 'views/wordlist/form';
import {SimplePageStore} from '../stores/base';

/**
 *
 */
class WordlistFormPage extends SimplePageStore implements Kontext.QuerySetupHandler {

    private layoutModel:PageModel;

    private corpusIdent:Kontext.FullCorpusIdent;

    private onSubcorpChangeActions:Array<(subcname:string)=>void> = [];

    private currentSubcorpus:string;

    private views:WordlistFormViews;


    constructor(layoutModel:PageModel, corpusIdent:Kontext.FullCorpusIdent) {
        super(layoutModel.dispatcher);
        this.layoutModel = layoutModel;
        this.corpusIdent = corpusIdent;
    }

    registerCorpusSelectionListener(fn:(corpname:string, aligned:Immutable.List<string>, subcorp:string)=>void) {}

    getCorpora():Immutable.List<string> {
        return Immutable.List<string>([this.corpusIdent.id]);
    }

    getCurrentSubcorpus():string {
        return this.currentSubcorpus;
    }

    getAvailableAlignedCorpora():Immutable.List<{n:string; label:string}> {
        return Immutable.List<{n:string; label:string}>();
    }

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
        /*
        popupBox(this.layoutModel).bind(
            $('#show-help-format-link'),
            this.layoutModel.translate('global__wl_white_lists'),
            {
                width: '300px'
            }
        );
        */
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

    private initSubcSelector():void {

        const currSubcorp = this.layoutModel.getConf<string>('subcorpname');
        const input = <HTMLInputElement>window.document.getElementById('hidden-subcorp-sel');
        input.value = currSubcorp ? currSubcorp : '';
        this.currentSubcorpus = input.value;

        this.layoutModel.renderReactComponent(
            this.views.WordlistCorpSelection,
            window.document.getElementById('corpus-select-mount'),
            {
                subcorpList: Immutable.List<Array<string>>(this.layoutModel.getConf<Array<string>>('SubcorpList'))
            }
        );
    }

    private initCorpInfoToolbar():void {
        this.layoutModel.renderReactComponent(
            this.views.CorpInfoToolbar,
            window.document.getElementById('query-overview-mount'),
            {
                corpname: this.layoutModel.getConf<string>('corpname'),
                humanCorpname: this.layoutModel.getConf<string>('humanCorpname'),
                usesubcorp: this.layoutModel.getConf<string>('subcorpname')
            }
        );
    }

    private initCorparchPlugin():React.Component {
        return createCorparch(
            'wordlist_form',
            this.layoutModel.pluginApi(),
            {
                getCurrentSubcorpus: () => null,
                getAvailableSubcorpora: () => Immutable.List<string>(),
                addChangeListener: (fn:Kontext.StoreListener) => undefined
            },
            this,
            {
                itemClickAction: (corpora:Array<string>, subcorpId:string) => {
                    window.location.href = this.layoutModel.createActionUrl('wordlist_form',
                    [['corpname', corpora[0]]]);
                }
            }
        );
    }

    private initActiveAttributeHighlight():void {
        $('.current-wlattr').on('mouseover', (evt) => {
            $('#srch-attrib-label').addClass('highlighted-label');
        });
        $('.current-wlattr').on('mouseout', (evt) => {
            $('#srch-attrib-label').removeClass('highlighted-label');
        });
    }

    private initActionHandling():void {
        this.layoutModel.dispatcher.register((payload:Kontext.DispatcherPayload) => {
            switch (payload.actionType) {
                case 'QUERY_INPUT_SELECT_SUBCORP':
                    const subcname:string = payload.props['subcorp'];
                    const input = <HTMLInputElement>window.document.getElementById('hidden-subcorp-sel');
                    input.value = subcname;
                    this.currentSubcorpus = subcname;
                    this.onSubcorpChangeActions.forEach(fn => {
                        fn.call(this, subcname);
                    });
                    this.notifyChangeListeners();
                break;
            }
        });
    }

    init():void {
        this.layoutModel.init().then(
            (d) => {
                this.initActionHandling();
                this.bindStaticElements();
                const corparchWidget = this.initCorparchPlugin();
                this.views = wordlistFormInit(
                    this.layoutModel.dispatcher,
                    this.layoutModel.exportMixins(),
                    this.layoutModel.layoutViews,
                    corparchWidget,
                    this
                );
                this.initSubcSelector();
                this.initOutputTypeForms();
                this.initCorpInfoToolbar();
                this.initActiveAttributeHighlight();
            }
        ).then(
            () => undefined,
            (err) => console.error(err)
        );
    }
}


export function init(conf:Kontext.Conf) {
    const layoutModel = new PageModel(conf);
    new WordlistFormPage(
        layoutModel,
        layoutModel.getConf<Kontext.FullCorpusIdent>('corpusIdent')
    ).init();
}