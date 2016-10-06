/*
 * Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

/// <reference path="../../types/ajaxResponses.d.ts" />

import {SimplePageStore} from '../../util';
import {PageModel} from '../../tpl/document';
import {ConcLineStore} from './lines';

/**
 *
 */
export type ConcDetailText = Array<{str:string; class:string}>;


type ExpandArgs = [number, number];

/**
 * A store providing access to a detailed/extended kwic information.
 */
export class ConcDetailStore extends SimplePageStore {

    private layoutModel:PageModel;

    private linesStore:ConcLineStore;

    private concDetail:ConcDetailText;

    private expandLeftArgs:ExpandArgs;

    private expandRightArgs:ExpandArgs;

    private corpusId:string;

    private tokenNum:number;

    private lineIdx:number;

    private wholeDocumentLoaded:boolean;

    private structCtx:string;


    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>, linesStore:ConcLineStore, structCtx:string) {
        super(dispatcher);
        const self = this;
        this.layoutModel = layoutModel;
        this.linesStore = linesStore;
        this.structCtx = structCtx;
        this.lineIdx = null;
        this.wholeDocumentLoaded = false;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CONCORDANCE_EXPAND_KWIC_DETAIL':
                    self.loadConcDetail(self.corpusId, self.tokenNum, self.lineIdx, payload.props['position']).then(
                        () => {
                            self.linesStore.setLineFocus(self.lineIdx, true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_KWIC_DETAIL':
                    self.loadConcDetail(payload.props['corpusId'], payload.props['tokenNumber'], payload.props['lineIdx']).then(
                        () => {
                            self.linesStore.setLineFocus(payload.props['lineIdx'], true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_SHOW_WHOLE_DOCUMENT':
                    self.loadWholeDocument().then(
                        () => {
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                        }
                    );
                break;
                case 'CONCORDANCE_RESET_DETAIL':
                    if (self.lineIdx !== null) {
                        self.linesStore.setLineFocus(self.lineIdx, false);
                        self.lineIdx = null;
                        self.corpusId = null;
                        self.tokenNum = null;
                        self.wholeDocumentLoaded = false;
                        self.notifyChangeListeners();
                        self.linesStore.notifyChangeListeners();
                    }
                break;
            }
        });
    }

    getConcDetail():ConcDetailText {
        return this.concDetail;
    }

    private loadWholeDocument():RSVP.Promise<any> {

        return this.layoutModel.ajax<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('structctx'),
            {
                corpname: this.corpusId,
                pos: this.tokenNum,
                struct: this.structCtx
            },
            {}

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.concDetail = data.content;
                    this.wholeDocumentLoaded = true;
                    this.expandLeftArgs = null;
                    this.expandRightArgs = null;

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }

    private loadConcDetail(corpusId:string, tokenNum:number, lineIdx:number, expand?:string):RSVP.Promise<any> {
        this.corpusId = corpusId;
        this.tokenNum = tokenNum;
        this.lineIdx = lineIdx;
        this.wholeDocumentLoaded = false;

        const args = this.layoutModel.getConcArgs().toDict();
        args['corpname'] = corpusId; // just for sure (is should be already in args)
        // we must delete 'usesubcorp' as the server API does not need it
        // and in case of an aligned corpus it even produces an error
        delete args['usesubcorp'];
        args['pos'] = String(tokenNum);
        args['format'] = 'json'

        if (expand === 'left') {
            args['detail_left_ctx'] = String(this.expandLeftArgs[0]);
            args['detail_right_ctx'] = String(this.expandLeftArgs[1]);

        } else if (expand === 'right') {
            args['detail_left_ctx'] = String(this.expandRightArgs[0]);
            args['detail_right_ctx'] = String(this.expandRightArgs[1]);
        }

        return this.layoutModel.ajax<AjaxResponse.WideCtx>(
            'GET',
            this.layoutModel.createActionUrl('widectx'),
            args,
            {}

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.concDetail = data.content;
                    if (data.expand_left_args) {
                        this.expandLeftArgs = [
                            data.expand_left_args.detail_left_ctx, data.expand_left_args.detail_right_ctx
                        ];

                    } else {
                        this.expandLeftArgs = null;
                    }
                    if (data.expand_right_args) {
                        this.expandRightArgs = [
                            data.expand_right_args.detail_left_ctx, data.expand_right_args.detail_right_ctx
                        ];

                    } else {
                        this.expandRightArgs = null;
                    }

                } else {
                    throw new Error(data.messages[0]);
                }
            }
        );
    }

    hasExpandLeft():boolean {
        return !!this.expandLeftArgs;
    }

    hasExpandRight():boolean {
        return !!this.expandRightArgs;
    }

    canDisplayWholeDocument():boolean {
        return this.structCtx && !this.wholeDocumentLoaded;
    }
}


export interface RefsColumn {
    name:string;
    val:string;
}

/**
 * Store providing structural attribute information (aka "text types") related to a specific token
 */
export class RefsDetailStore extends SimplePageStore {

    private layoutModel:PageModel;

    private data:Array<RefsColumn>;

    private linesStore:ConcLineStore;

    private lineIdx:number;

    constructor(layoutModel:PageModel, dispatcher:Dispatcher.Dispatcher<any>, linesStore:ConcLineStore) {
        super(dispatcher);
        const self = this;
        this.layoutModel = layoutModel;
        this.linesStore = linesStore;
        this.lineIdx = null;

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'CONCORDANCE_SHOW_REF_DETAIL':
                    self.loadRefs(payload.props['corpusId'], payload.props['tokenNumber'], payload.props['lineIdx']).then(
                        () => {
                            self.linesStore.setLineFocus(payload.props['lineIdx'], true);
                            self.linesStore.notifyChangeListeners();
                            self.notifyChangeListeners();
                        },
                        (err) => {
                            self.layoutModel.showMessage('error', err);
                            self.notifyChangeListeners();
                        }
                    );
                break;
                case 'CONCORDANCE_REF_RESET_DETAIL':
                    if (self.lineIdx !== null) {
                        self.linesStore.setLineFocus(self.lineIdx, false);
                        self.lineIdx = null;
                        self.notifyChangeListeners();
                        self.linesStore.notifyChangeListeners();
                    }
                break;
            }
        });
    }

    getData():Array<[RefsColumn, RefsColumn]> {
        const ans:Array<[RefsColumn, RefsColumn]> = [];
        for (let i = 0; i < this.data.length; i += 2) {
            ans.push([this.data[i], this.data[i+1]]);
        }
        return ans;
    }

    private loadRefs(corpusId:string, tokenNum:number, lineIdx:number):RSVP.Promise<any> {
        return this.layoutModel.ajax<AjaxResponse.FullRef>(
            'GET',
            this.layoutModel.createActionUrl('fullref'),
            {corpname: corpusId, pos: tokenNum},
            {
                contentType : 'application/x-www-form-urlencoded',
                accept: 'application/json'
            }

        ).then(
            (data) => {
                if (!data.contains_errors) {
                    this.lineIdx = lineIdx;
                    this.data = data.Refs;

                } else {
                    throw new Error('Invalid response');
                }
            }
        );
    }
}
