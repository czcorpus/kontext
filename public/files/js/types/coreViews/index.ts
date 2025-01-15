/*
 * Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

import * as Abbreviation from './abbreviation.js';
import * as AjaxLoaderBarImage from './ajaxLoaderBarImage.js';
import * as AjaxLoaderImage from './ajaxLoaderImage.js';
import * as Calendar from './calendar.js';
import * as CloseableFrame from './closeableFrame.js';
import * as CorpnameInfoTrigger from './corpnameInfoTrigger.js';
import * as DelItemIcon from './delItemIcon.js';
import * as ConfIcon from './delItemIcon.js';
import * as ErrorBoundary from './errorBoundary.js';
import * as ExpandableArea from './expandableArea.js';
import * as ExpandButton from './expandButton.js';
import * as FadeInFrame from './fadeInFrame.js';
import * as ImgWithHighlight from './imgWithHighlight.js';
import * as ImgWithMouseover from './imgWithMoseover.js';
import * as InlineHelp from './inlineHelp.js';
import * as IssueReportingLink from './issueReportingLink.js';
import * as KwicRangeSelector from './kwicRangeSelector.js';
import * as Messages from './messages.js';
import * as ModalOverlay from './modalOverlay.js';
import * as PlusButton from './plusButton.js';
import * as PopupBox from './popupBox.js';
import * as Shortener from './shortener.js';
import * as StatusIcon from './statusIcon.js';
import * as TabButton from './tabButton.js';
import * as TabView from './tabView.js';
import * as ToggleSwitch from './toggleSwitch.js';
import * as UnsupportedRenderer from './unsupportedRenderer.js';
import * as ValidatedItem from './validateItem.js';
import * as ResponsiveWrapper from './responsiveWrapper.js';
import * as SimplePaginator from './simplePaginator.js';

// -------------------------------

export interface Runtime {
    Abbreviation:Abbreviation.Component;
    AjaxLoaderImage:AjaxLoaderImage.Component;
    AjaxLoaderBarImage:AjaxLoaderBarImage.Component;
    Calendar:Calendar.Component;
    CloseableFrame:CloseableFrame.Component;
    CorpnameInfoTrigger:CorpnameInfoTrigger.Component;
    DelItemIcon:DelItemIcon.Component;
    ConfIcon:ConfIcon.Component;
    ErrorBoundary: ErrorBoundary.Component;
    ExpandableArea:ExpandableArea.Component;
    ExpandButton:ExpandButton.Component;
    FadeInFrame:FadeInFrame.Component;
    ImgWithHighlight:ImgWithHighlight.Component;
    ImgWithMouseover:ImgWithMouseover.Component;
    InlineHelp:InlineHelp.Component;
    IssueReportingLink:IssueReportingLink.Component;
    KwicRangeSelector:KwicRangeSelector.Component;
    Messages:Messages.Component;
    ModalOverlay: ModalOverlay.Component;
    PlusButton:PlusButton.Component;
    PopupBox:PopupBox.Component;
    Shortener:Shortener.Component;
    StatusIcon:StatusIcon.Component;
    TabButton:TabButton.Component;
    TabView:TabView.Component;
    ToggleSwitch:ToggleSwitch.Component;
    UnsupportedRenderer:UnsupportedRenderer.Component;
    ValidatedItem:ValidatedItem.Component;
    ResponsiveWrapper:ResponsiveWrapper.Component;
    SimplePaginator:SimplePaginator.Component;
}

export { AutoWidth } from './common.js';

export * as Abbreviation from './abbreviation.js';
export * as AjaxLoaderBarImage from './ajaxLoaderBarImage.js';
export * as AjaxLoaderImage from './ajaxLoaderImage.js';
export * as Calendar from './calendar.js';
export * as CloseableFrame from './closeableFrame.js';
export * as CorpnameInfoTrigger from './corpnameInfoTrigger.js';
export * as DelItemIcon from './delItemIcon.js';
export * as ConfIcon from './delItemIcon.js';
export * as ErrorBoundary from './errorBoundary.js';
export * as ExpandableArea from './expandableArea.js';
export * as ExpandButton from './expandButton.js';
export * as FadeInFrame from './fadeInFrame.js';
export * as ImgWithHighlight from './imgWithHighlight.js';
export * as ImgWithMouseover from './imgWithMoseover.js';
export * as InlineHelp from './inlineHelp.js';
export * as IssueReportingLink from './issueReportingLink.js';
export * as KwicRangeSelector from './kwicRangeSelector.js';
export * as Message from './message.js';
export * as Messages from './messages.js';
export * as ModalOverlay from './modalOverlay.js';
export * as PlusButton from './plusButton.js';
export * as PopupBox from './popupBox.js';
export * as Shortener from './shortener.js';
export * as StatusIcon from './statusIcon.js';
export * as TabButton from './tabButton.js';
export * as TabView from './tabView.js';
export * as ToggleSwitch from './toggleSwitch.js';
export * as UnsupportedRenderer from './unsupportedRenderer.js';
export * as ValidatedItem from './validateItem.js';
export * as ResponsiveWrapper from './responsiveWrapper.js';
export * as SimplePaginator from './simplePaginator.js';