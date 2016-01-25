/*
 * Copyright (c) 2016 Institute of the Czech National Corpus
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

/// <reference path="../../ts/declarations/common.d.ts" />
/// <reference path="../../ts/declarations/flux.d.ts" />
/// <reference path="../../ts/declarations/rsvp.d.ts" />

import util = require('util');
import conclines = require('conclines');
import tplDocument = require('tpl/document');


export interface RedirectingResponse {
    next_url: string;
    id: string;
}

/**
 * This Flux store class handles state of selected concordance lines.
 * The selection can have one of two modes:
 * - binary (checked/unchecked)
 * - categorical (0,1,2,3,4)
 */
export class LineSelectionStore extends util.SimplePageStore {

    private layoutModel:tplDocument.PageModel;

    private mode:string;

    private clStorage:conclines.ConcLinesStorage;

    private clearSelectionHandlers:Array<()=>void>;

    private actionFinishHandlers:Array<()=>void>;

    static FILTER_NEGATIVE = 'n';

    static FILTER_POSITIVE = 'p';

    constructor(layoutModel:tplDocument.PageModel, dispatcher:Dispatcher.Dispatcher<any>,
            clStorage:conclines.ConcLinesStorage, mode:string) {
        super(dispatcher);
        let self = this;
        this.layoutModel = layoutModel;
        this.clStorage = clStorage;
        this.mode = this.clStorage.getMode();
        this.clearSelectionHandlers = [];
        this.actionFinishHandlers = [];

        this.dispatcher.register(function (payload:Kontext.DispatcherPayload) {
            switch (payload.actionType) {
                case 'LINE_SELECTION_STATUS_REQUEST':
                    self.notifyChangeListeners('STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_RESET':
                    self.clearSelection();
                    self.notifyChangeListeners('STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_REMOVE_LINES':
                    self.removeLines(LineSelectionStore.FILTER_NEGATIVE);
                    self.notifyChangeListeners('STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_REMOVE_OTHER_LINES':
                    self.removeLines(LineSelectionStore.FILTER_POSITIVE);
                    self.notifyChangeListeners('STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_MARK_LINES':
                    self.markLines();
                    self.notifyChangeListeners('STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_MARK_LINES_REMOVE_OTHERS':
                    self.markLines(true);
                    self.notifyChangeListeners('STATUS_UPDATED');
                    break;
                case 'LINE_SELECTION_SAVE_UNFINISHED':
                    self.saveUnfinishedStateToServer(payload.props['saveName']).then(
                        function (data) {
                            self.notifyChangeListeners('STATUS_UPDATED_LINES_SAVED');
                        }
                    );
            }
        });
    }

    private clearSelection():void {
        this.clStorage.clear();
        this.clearSelectionHandlers.forEach(function (item:()=>void) {
            item();
        });
    }

    private finishAjaxAction<T>(prom:RSVP.Promise<T>) {
        /*
         * please note that we do not have to update layout model
         * query code or any other state parameter here because client
         * is redirected to the 'next_url' once the action is done
         */
        let self = this;
        prom.then(
            function (data:any) { // TODO type
                self.performActionFinishHandlers();
                if (!data.error) {
                    self.clStorage.clear();
                    $(window).off('beforeunload.alert_unsaved'); // TODO
                    window.location.href = data.next_url;

                } else {
                    self.layoutModel.showMessage('error', data.error);
                }
            },
            function (err) {
                self.performActionFinishHandlers();
                self.layoutModel.showMessage('error', err);
            }
        );
    }

    public resetServerLineGroups():void {
        let prom:RSVP.Promise<RedirectingResponse> = this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_unset_lines_groups?' +  this.layoutModel.getConf('stateParams')),
            {},
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxAction(prom);
    }

    private markLines(removeOthers:boolean=false):void {
        let self = this;
        let prom:RSVP.Promise<RedirectingResponse> = this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_apply_lines_groups?' + self.layoutModel.getConf('stateParams')),
            {
                rows : JSON.stringify(self.clStorage.getAll()),
                remove_rest: removeOthers ? '1' : '0'
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxAction(prom);
    }

    private removeLines(filter:string):void {
        let self = this;
        let prom:RSVP.Promise<RedirectingResponse> = this.layoutModel.ajax<RedirectingResponse>(
            'POST',
            this.layoutModel.createActionUrl('ajax_remove_selected_lines?pnfilter='
                + filter + '&' + self.layoutModel.getConf('stateParams')),
            {
                rows : JSON.stringify(self.getAll())
            },
            {
                contentType : 'application/x-www-form-urlencoded'
            }
        );
        this.finishAjaxAction(prom);
    }

    addClearSelectionHandler(fn:()=>void):void {
        this.clearSelectionHandlers.push(fn);
    }

    addActionFinishHandler(fn:()=>void):void {
        this.actionFinishHandlers.push(fn);
    }

    removeActionFinishHandler(fn:()=>void):void {
        for (let i = 0; i < this.actionFinishHandlers.length; i += 1) {
            if (this.actionFinishHandlers[i] === fn) {
                this.actionFinishHandlers.splice(i, 1);
                break;
            }
        }
    }

    removeAllActionFinishHandlers():void {
        this.actionFinishHandlers = [];
    }

    private performActionFinishHandlers():void {
        this.actionFinishHandlers.forEach((fn:()=>void)=> fn());
    }

    getMode():string {
        return this.mode;
    }

    setMode(mode:string):void {
        this.mode = mode;
        if (this.mode !== this.clStorage.getMode()) {
            this.clStorage.switchMode();
            this.notifyChangeListeners('STATUS_UPDATED');
         }
     }

     switchMode():void {
         this.clStorage.switchMode();
         this.notifyChangeListeners('STATUS_UPDATED');
     }

     saveUnfinishedStateToServer(saveName:string):RSVP.Promise<any> {
         let self = this;
         let prom:RSVP.Promise<any> = this.layoutModel.ajax(
             'POST',
             this.layoutModel.createActionUrl('ajax_store_unfinished_selection'),
             {
                 data: this.clStorage.getAsJson(),
                 save_name: saveName
             },
             {contentType : 'application/x-www-form-urlencoded'}
         );

         return prom.then(
             function (data) {
                self.performActionFinishHandlers();
                if (!data.error) {
                    self.layoutModel.showMessage('info',
                            self.layoutModel.translate('global__line_selection_saved'));

                } else {
                    self.layoutModel.showMessage('error', data.error);
                }
            },
            function (err) {
                self.performActionFinishHandlers();
                self.layoutModel.showMessage('error', err);
            }
         );
     }

     addLine(id:string, kwiclen:number, category:number):void {
         return this.clStorage.addLine(id, kwiclen, category);
     }

     removeLine(id):void {
         return this.clStorage.removeLine(id);
     }

     containsLine(id:string):boolean {
         return this.clStorage.containsLine(id);
     }

     getLine(id:string):any {
         return this.clStorage.getLine(id);
     }

     getAll():any {
         return this.clStorage.getAll();
     }

     clear():void {
         return this.clStorage.clear();
     }

     size():number {
         return this.clStorage.size();
     }

     supportsSessionStorage():boolean {
         return this.clStorage.supportsSessionStorage();
     }

     serialize():void {
         this.clStorage.serialize();
     }

}