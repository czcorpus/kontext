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

import * as React from 'react';
import {ViewOptions} from './common';


export namespace CoreViews {

    export enum AutoWidth {
        WIDE = 'wide',
        NARROW = 'narrow'
    }

    export namespace ErrorBoundary {
        export type Component = React.ComponentClass<{}>;
    }

    // ---------------------------

    export namespace ModalOverlay {

        export interface Props {
            onCloseKey:()=>void;
            isScrollable?:boolean;
            children:React.ReactNode;
        }

        export interface State {
        }

        export type Component = React.ComponentClass<Props>;
    }

    // ---------------------------

    export namespace PopupBox {

        export interface Props {

            /**
             * a custom action to be performed once the component is mounted
             */
            onReady?:(elm:HTMLElement)=>void;

            /**
             * a custom action to be performed when user clicks 'close'
             */
            onCloseClick:()=>void;

            /**
             * An optional handler triggered in case user clicks anywhere
             * within PopupBox. This can be used e.g. to regain focus.
             */
            onAreaClick?:()=>void;

            status?:string;

            /**
             * an optional inline CSS
             */
            customStyle?:{[prop:string]:string};

            /**
             * if true then the "close" button will take the focus
             * allowing instant closing by ESC or handling keys
             * by a custom handler (see the next prop)
             */
            takeFocus?:boolean;

            /**
             * an optional function called in case of a 'onKeyDown' event
             */
            keyPressHandler?:(evt:React.SyntheticEvent<{}>)=>void;

            customClass?:string;

            autoWidth?:CoreViews.AutoWidth;

            children:React.ReactNode;
        }

        export interface State {}

        export type Component = React.ComponentClass<Props>;

    }

    // -------------------------------

    export namespace ImgWithMouseover {

        export interface Props {
            src:string;
            src2?:string;
            htmlClass?:string;
            clickHandler?:()=>void;
            alt:string;
            title?:string;
            style?:{[prop:string]:string};
        }

        export interface State {
            isMouseover:boolean;
        }

        export type Component = React.ComponentClass<Props>;
    }

    // -------------------------------

    export namespace CloseableFrame {

        export interface Props {
            onCloseClick:()=>void;
            onReady?:(elm:HTMLElement)=>void;
            customClass?:string;
            scrollable?:boolean;
            autoWidth?:CoreViews.AutoWidth;
            label:string;
            children:React.ReactNode;
        }

        export type Component = React.ComponentClass<Props>;

    }

    // -------------------------------

    export namespace InlineHelp {

        export interface Props {
            children:React.ReactNode;
            noSuperscript?:boolean;
            customStyle?:{[key:string]:string};
            url?:string;
        }

        export interface State {
            helpVisible:boolean;
        }

        export type Component = React.ComponentClass<Props>;

    }

    // -------------------------------

    export namespace Abbreviation {

        export interface Props {
            value:string;
            desc:string;
            customStyle?:{[key:string]:string};
            url?:string;
        }

        export type Component = React.ComponentClass<Props>;
    }

    // -------------------------------

    export namespace Message {

        export interface Props {
            messageId:string;
            messageType:string;
            messageText:string;
            ttl:number;
            timeFadeout:number;
        }
    }

    // -------------------------------

    export namespace Messages {

        export interface Props {}

        export type Component = React.ComponentClass<Props>;
    }

    // -------------------------------

    export namespace FadeInFrame {

        export interface Props {
            opacity:number;
            children:React.ReactNode;
        }

        export type Component = React.SFC<Props>;
    }

    // -------------------------------

    export namespace IssueReportingLink {

        export interface Props {
            url:string;
            blank_window:boolean;
            type:string;
            label:string;
            onClick:()=>void;
        }

        export type Component = React.SFC<Props>;
    }

    // -------------------------------

    export namespace AjaxLoaderImage {
        export interface Props {
            htmlClass?:string;
            title?:string;
        }
        export type Component = React.SFC<Props>;
    }

    // -------------------------------

    export namespace AjaxLoaderBarImage {
        export interface Props {
            htmlClass?:string;
            title?:string;
        }
        export type Component = React.SFC<Props>;
    }

    // -------------------------------

    export namespace CorpnameInfoTrigger {

        export interface Props {
            corpname:string;
            usesubcorp:string;
            origSubcorpName:string;
            foreignSubcorp:boolean;
            humanCorpname:string;
        }

        export type Component = React.SFC<Props>;

    }

    export namespace Shortener {

        export interface Props {
            text:string;
            limit?:number;
            className?:string;
        }

        export type Component = React.SFC<Props>;
    }

    export namespace StatusIcon {

        export interface Props {
            status:string;
            htmlClass?:string;
            inline?:boolean;
        }

        export type Component = React.SFC<Props>;
    }

    export namespace DelItemIcon {

        export interface Props {
            className?:string;
            title?:string;
            disabled?:boolean;
            onClick?:()=>void;
        }

        export type Component = React.SFC<Props>;
    }

    export namespace ValidatedItem {

        export interface Props {
            invalid:boolean;
        }

        export type Component = React.SFC<Props>;
    }

    export namespace TabButton {

        export interface Props {
            isActive:boolean;
            label:string;
            htmlClass?:string;
            onClick:()=>void;
        }

        export type Component = React.SFC<Props>;
    }

    export namespace PlusButton {

        export interface Props {
            mouseOverHint?:string;
            htmlClass?:string;
            onClick:()=>void;
        }

        export type Component = React.SFC<Props>;
    }

    // -------------------------------

    export interface Runtime {
        ErrorBoundary: ErrorBoundary.Component;
        ModalOverlay: ModalOverlay.Component;
        PopupBox:PopupBox.Component;
        ImgWithMouseover:ImgWithMouseover.Component;
        CloseableFrame:CloseableFrame.Component;
        InlineHelp:InlineHelp.Component;
        Abbreviation:Abbreviation.Component;
        Messages:Messages.Component;
        IssueReportingLink:IssueReportingLink.Component;
        AjaxLoaderImage:AjaxLoaderImage.Component;
        AjaxLoaderBarImage:AjaxLoaderBarImage.Component;
        CorpnameInfoTrigger:CorpnameInfoTrigger.Component;
        Shortener:Shortener.Component;
        StatusIcon:StatusIcon.Component;
        DelItemIcon:DelItemIcon.Component;
        ValidatedItem:ValidatedItem.Component;
        TabButton:TabButton.Component;
        PlusButton:PlusButton.Component;
    }
}


