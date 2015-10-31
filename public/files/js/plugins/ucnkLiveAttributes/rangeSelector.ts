/*
 * Copyright (c) 2015 Institute of the Czech National Corpus
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

/// <reference path="../../../ts/declarations/common.d.ts" />
/// <reference path="../../../ts/declarations/jquery.d.ts" />


/**
 * A minimal interface required by RangeSelector to cooperate with
 * text types checkboxes.
 */
export interface CheckboxLists {

    applyOnCheckboxes(attribName:string, callback:{(i:number, item:HTMLElement):void}):void;

    tableIsRange(attribName:string):boolean;

    getTable(name:string):HTMLElement;
}


enum IntervalChar {
    LEFT, BOTH, RIGHT
}

/**
 * RangeSelector provides a convenient way how to
 * select multiple values at once. It is even able
 * to handle values defined as intervals (i.e. it selects
 * interval of intervals in such case).
 */
export class RangeSelector {

    private pluginApi:Kontext.PluginApi;

    private checkboxLists:CheckboxLists;

    private altElm:HTMLElement;

    private rootElm:HTMLElement;

    private attribName:string;

    intervalChars:Array<string>;

    private switchLink:HTMLElement;

    private isActive:boolean;

    private onShow:()=>void;

    private onHide:()=>void;

    /**
     * @param pluginApi
     * @param checkboxLists - an object providing access to text type checkboxes (see init.ts)
     * @param altElm - an alternative content element for the widget
     *                 (= default TD containing a list of checkboxes)
     * @param attribName - a text type attribute bound to this range selector (e.g. "doc.year")
     * @param intervalChars - a triple ([left_interval_str, interval_str, right_interval_str],
     *                        e.g. ['-', '+/-', '+'])
     */
	constructor(pluginApi:Kontext.PluginApi, checkboxLists:CheckboxLists, altElm:HTMLElement,
            attribName:string, intervalChars:Array<string>) {
        this.pluginApi = pluginApi;
        this.checkboxLists = checkboxLists;
        this.altElm = altElm;
        this.rootElm = null;
        this.attribName = attribName;
        this.intervalChars = intervalChars;
        this.switchLink = null;
        this.isActive = false;
        this.onShow = ()=>undefined;
        this.onHide = ()=>undefined;
	}

    private createIntervalLimitsSwitch():HTMLElement {
        let div = window.document.createElement('div');
        let select = window.document.createElement('select');
        let hintDiv = window.document.createElement('div');
        let label = window.document.createElement('span');

        $(label)
            .addClass('label')
            .text(this.pluginApi.translate('ucnkLA__interval_inclusion_policy') + ': ');

        $(div).append(label);
        $(select)
            .addClass('interval-behavior')
            .append('<option value="strict">' + this.pluginApi.translate('ucnkLA__strict_interval') + '</option>')
            .append('<option value="relaxed">' + this.pluginApi.translate('ucnkLA__partial_interval') + '</option>');
        $(div).append(select);
        $(hintDiv).addClass('hint-diagram');
        $(div).append(hintDiv);
        $(select).on('change keyup', function (event:JQueryEventObject) {
            if (!event.keyCode || event.keyCode === 38 || event.keyCode === 40) {
                if ($(select).val() === 'strict') {
                    $(hintDiv).removeClass('alt');

                } else {
                    $(hintDiv).addClass('alt');
                }
            }
        });
        return div;
    }

    private decodeRange(s:string):{lft:number, rgt:number} {
        let center:number;
        let ans:{lft:number; rgt:number};
        let parsed:Array<string>;
        let defines = (ic) => this.intervalChars[ic] && s.indexOf(this.intervalChars[ic]) > -1;


        if (defines(IntervalChar.LEFT)) {
            parsed = s.split(this.intervalChars[IntervalChar.LEFT]);
            center = parseInt(parsed[0]);
            ans = {
                lft: center - parseInt(parsed[1]),
                rgt: center
            };

        } else if (defines(IntervalChar.BOTH)) {
            parsed = s.split(this.intervalChars[IntervalChar.BOTH]);
            center = parseInt(parsed[0]);
            ans = {
                lft: center - parseInt(parsed[1]),
                rgt: center + parseInt(parsed[1])
            };

        } else if (defines(IntervalChar.RIGHT)) {
            parsed = s.split(this.intervalChars[IntervalChar.RIGHT]);
            center = parseInt(parsed[0]);
            ans = {
                lft: center,
                rgt: center + parseInt(parsed[1])
            };

        } else if (/^\d+$/.exec(s)) {
            ans = {
                lft: parseInt(s),
                rgt: parseInt(s)
            };

        } else {
            ans = null;
        }
        return ans;
    }

    private checkIntervalRange(from:number, to:number,
            strictMode:boolean, keepCurrent:boolean):number {
        let tab = this.checkboxLists.getTable(this.attribName);
        let numChecked = 0;
        let self = this;

        if (tab) {
            $(tab).find('input.attr-selector').each(function () {
                let interval = self.decodeRange($(this).val());
                if (!interval) {
                    return true; // silently ignore unknown entries
                }
                let [lft, rgt] = [interval.lft, interval.rgt];

                if (strictMode) {
                    if ((lft >= from && rgt >= from && lft <= to && rgt <= to)
                            || (lft <= to && rgt <= to && isNaN(from))
                            || (lft >= from && rgt >= from && isNaN(to))) {
                        $(this).prop('checked', true);
                        numChecked += 1;

                    } else if (!keepCurrent) {
                        $(this).prop('checked', false);
                    }

                } else {
                    if ((lft >= from && lft <= to) || (lft >= from && isNaN(to)) || (rgt >= from && isNaN(to))
                            || (rgt >= from && rgt <= to) || (lft <= to && isNaN(from)) || (rgt <= to && isNaN(from))) {
                        $(this).prop('checked', true);
                        numChecked += 1;

                    } else {
                        $(this).prop('checked', false);
                    }
                }
            });
        }
        return numChecked;
    }

    private focusFirstChecked() {
        let table = this.checkboxLists.getTable(this.attribName);
         $(table).find('tr.data-rows input.attr-selector[type="checkbox"]:checked').first().focus();
    }

    private checkRange(attribName:string, from:number, to:number, keepCurrent:boolean):number {
        let numChecked = 0;
        this.checkboxLists.applyOnCheckboxes(attribName, function (i, item) {
            let v = parseInt($(item).val());
            if ((v >= from || isNaN(from)) && (v <= to || isNaN(to))) {
                $(item).prop('checked', true);
                numChecked += 1;

            } else if (!keepCurrent) {
                $(item).prop('checked', false);
            }
         });
        return numChecked;
    }

    private hide():void {
        $(this.rootElm).hide();
        $(this.altElm).show();
        if (this.switchLink) {
            $(this.switchLink).text(this.pluginApi.translate('ucnkLA__select_range'));
        }
        this.isActive = false;
        this.onHide.call(this);
        this.focusFirstChecked();
    }

    private show():void {
        let numSelected = 0;
        let keepCurrBox = $(this.rootElm).find('div.keep-current');

        this.checkboxLists.applyOnCheckboxes(this.attribName,
                (i, item) => numSelected += $(item).is(':checked') ? 1 : 0);

        if (numSelected > 0) {
            keepCurrBox.html('<label><input class="keep-current" type="checkbox" checked="checked" />'
                    + this.pluginApi.translate('ucnkLA__keep_current_selection') + '</label>');

        } else {
            keepCurrBox.empty();
        }

        $(this.rootElm).show();
        $(this.altElm).hide();
        if (this.switchLink) {
            $(this.switchLink).text(this.pluginApi.translate('ucnkLA__select_individual'));
        }
        this.isActive = true;
        this.onShow.call(this);
        $(this.rootElm).find('input.from-value').focus();
    }

    private bindSwitchLink():void {
        let self = this;
        $(this.switchLink).on('click', function () {
            if (self.isActive) {
                self.hide();

            } else {
                self.show();
            }
        });
    }

    /**
     * Creates the widget.
     */
	init(switchLink:HTMLElement, onShow?:()=>void, onHide?:()=>void):void {
        let self = this;
        this.rootElm = document.createElement('tr');
        let tdElm = document.createElement('td');

        if (typeof onShow === 'function') {
            this.onShow = onShow;
        }
        if (typeof onHide === 'function') {
            this.onHide = onHide;
        }

        $(tdElm).addClass('range-selector');

        $(this.rootElm)
            .addClass('range')
            .append(tdElm);
        $(this.altElm)
            .after(this.rootElm);

        this.switchLink = switchLink;

        $(tdElm).append(
            '<h3>' + this.pluginApi.translate('ucnkLA__define_range')
            + '</h3>'
            + '<div><label class="date">'
            + this.pluginApi.translate('ucnkLA__from') + ':&nbsp;'
            + '<input class="from-value" type="text" style="width: 5em" />'
            + '</label>&nbsp;'
            + '<label class="date">'
            + this.pluginApi.translate('ucnkLA__to') + ':&nbsp;'
            + '<input class="to-value" type="text" style="width: 5em" />'
            + '</label>'
            + '</div>'
            + '<div class="keep-current"></div>'
            + '<div class="interval-switch"></div>'
            + '<button class="default-button confirm-range" type="button">'
            + this.pluginApi.translate('ucnkLA__OK') + '</button>'
        );
        if (this.checkboxLists.tableIsRange(this.attribName)) {
            $(tdElm).find('div.interval-switch').append(this.createIntervalLimitsSwitch());
        }
        $(tdElm).find('button.confirm-range').on('click', function (evt) {
            let fromVal = parseInt($(tdElm).find('input.from-value').val());
            let toVal = parseInt($(tdElm).find('input.to-value').val());
            let numChecked;

            if (isNaN(fromVal) && isNaN(toVal)) {
                self.pluginApi.showMessage('warning',
                        self.pluginApi.translate('ucnkLA__at_least_one_required'));

            } else {
                let intervalSwitch = $(tdElm).find('select.interval-behavior');

                if (intervalSwitch.length > 0) {
                    numChecked = self.checkIntervalRange(
                        fromVal,
                        toVal,
                        intervalSwitch.val() === 'strict',
                        $(tdElm).find('input.keep-current').is(':checked')
                    );

                } else {
                    numChecked = self.checkRange(
                        self.attribName,
                        fromVal,
                        toVal,
                        $(tdElm).find('input.keep-current').is(':checked')
                    );
                }

                if (numChecked > 0) {
                    self.hide();

                } else {
                    self.pluginApi.showMessage('warning',
                        self.pluginApi.translate('ucnkLA__nothing_selected'));
                }
            }
        });
        this.show();
        this.bindSwitchLink();
    }
}

/**
 * A factory function used to create a RangeSelector instance
 */
export function create(pluginApi:Kontext.PluginApi, checkboxLists:CheckboxLists, altElm:HTMLElement,
            attribName:string, intervalChars:Array<string>):RangeSelector {
    return new RangeSelector(pluginApi, checkboxLists, altElm, attribName, intervalChars);
}