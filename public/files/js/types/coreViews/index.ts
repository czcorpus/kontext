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

import * as Abbreviation from './abbreviation';
import * as AjaxLoaderBarImage from './ajaxLoaderBarImage';
import * as AjaxLoaderImage from './ajaxLoaderImage';
import * as Calendar from './calendar';
import * as CloseableFrame from './closeableFrame';
import * as CorpnameInfoTrigger from './corpnameInfoTrigger';
import * as DelItemIcon from './delItemIcon';
import * as ErrorBoundary from './errorBoundary';
import * as ExpandableArea from './expandableArea';
import * as ExpandButton from './expandButton';
import * as FadeInFrame from './fadeInFrame';
import * as ImgWithHighlight from './imgWithHighlight';
import * as ImgWithMouseover from './imgWithMoseover';
import * as InlineHelp from './inlineHelp';
import * as IssueReportingLink from './issueReportingLink';
import * as KwicRangeSelector from './kwicRangeSelector';
import * as Messages from './messages';
import * as ModalOverlay from './modalOverlay';
import * as PlusButton from './plusButton';
import * as PopupBox from './popupBox';
import * as Shortener from './shortener';
import * as StatusIcon from './statusIcon';
import * as TabButton from './tabButton';
import * as TabView from './tabView';
import * as ToggleSwitch from './toggleSwitch';
import * as UnsupportedRenderer from './unsupportedRenderer';
import * as ValidatedItem from './validateItem';

// -------------------------------

export interface Runtime {
    Abbreviation:Abbreviation.Component;
    AjaxLoaderImage:AjaxLoaderImage.Component;
    AjaxLoaderBarImage:AjaxLoaderBarImage.Component;
    Calendar:Calendar.Component;
    CloseableFrame:CloseableFrame.Component;
    CorpnameInfoTrigger:CorpnameInfoTrigger.Component;
    DelItemIcon:DelItemIcon.Component;
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
}

export { AutoWidth } from './common';

export * as Abbreviation from './abbreviation';
export * as AjaxLoaderBarImage from './ajaxLoaderBarImage';
export * as AjaxLoaderImage from './ajaxLoaderImage';
export * as Calendar from './calendar';
export * as CloseableFrame from './closeableFrame';
export * as CorpnameInfoTrigger from './corpnameInfoTrigger';
export * as DelItemIcon from './delItemIcon';
export * as ErrorBoundary from './errorBoundary';
export * as ExpandableArea from './expandableArea';
export * as ExpandButton from './expandButton';
export * as FadeInFrame from './fadeInFrame';
export * as ImgWithHighlight from './imgWithHighlight';
export * as ImgWithMouseover from './imgWithMoseover';
export * as InlineHelp from './inlineHelp';
export * as IssueReportingLink from './issueReportingLink';
export * as KwicRangeSelector from './kwicRangeSelector';
export * as Message from './message';
export * as Messages from './messages';
export * as ModalOverlay from './modalOverlay';
export * as PlusButton from './plusButton';
export * as PopupBox from './popupBox';
export * as Shortener from './shortener';
export * as StatusIcon from './statusIcon';
export * as TabButton from './tabButton';
export * as TabView from './tabView';
export * as ToggleSwitch from './toggleSwitch';
export * as UnsupportedRenderer from './unsupportedRenderer';
export * as ValidatedItem from './validateItem';