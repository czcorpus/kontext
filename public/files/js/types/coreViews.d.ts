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


declare namespace CoreViews {

    namespace ModalOverlay {

        interface Props {
            onCloseKey:()=>void;
            isScrollable?:boolean;
            children:React.ReactNode;
        }

        interface State {
        }

        type Component = React.ComponentClass<Props>;
    }

    // ---------------------------

    namespace PopupBox {

        interface Props {

            /**
             * a custom action to be performed once the component is mounted
             */
            onReady?:(elm:HTMLElement)=>void;

            /**
             * a custom action to be performed when user clicks 'close'
             */
            onCloseClick:()=>void;

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

            autoSize?:boolean;

            children:React.ReactNode;
        }

        interface State {}

        type Component = React.ComponentClass<Props>;

    }

    // -------------------------------

    namespace ImgWithMouseover {

        interface Props {
            src:string;
            src2?:string;
            htmlClass?:string;
            clickHandler?:()=>void;
            alt:string;
        }

        interface State {
            isMouseover:boolean;
        }

        type Component = React.ComponentClass<Props>;
    }

    // -------------------------------

    namespace CloseableFrame {

        interface Props {
            onCloseClick:()=>void;
            customClass?:string;
            scrollable?:boolean;
            label:string;
            children:React.ReactNode;
        }

        type Component = React.SFC<Props>;

    }

    // -------------------------------

    namespace InlineHelp {

        interface Props {
            customStyle:{[key:string]:string};
            children:React.ReactNode;
            url?:string;
        }

        interface State {
            helpVisible:boolean;
        }

        type Component = React.ComponentClass<Props>;

    }

    // -------------------------------

    namespace Message {

        interface Props {
            messageId:string;
            fadingOut:boolean;
            transitionTime:number;
            messageType:string;
            messageText:string;
        }

        interface Props {
            mode:string;
            transitionTime:number;
            children:React.ReactNode;
        }
    }

    // -------------------------------

    namespace Messages {

        interface Props {}

        interface State {
            messages:any; // TODO type
            transitionTime:number;
        }

        type Component = React.ComponentClass<Props>;
    }

    // -------------------------------

    namespace FadeInFrame {

        interface State {
            opacity:number;
        }

        interface Props {
            transitionTime:number;
            mode:string;
            children:React.ReactNode;
        }

        type Component = React.ComponentClass<Props>;
    }

    // -------------------------------

    namespace IssueReportingLink {

        interface Props {
            url:string;
            blank_window:boolean;
            type:string;
            label:string;
            onClick:()=>void;
        }

        type Component = React.SFC<Props>;
    }

    // -------------------------------

    namespace AjaxLoaderImage {
        interface Props {}
        type Component = React.SFC<Props>;
    }

    // -------------------------------

    namespace AjaxLoaderBarImage {
        interface Props {}
        type Component = React.SFC<Props>;
    }

    // -------------------------------

    namespace CorpnameInfoTrigger {

        interface Props {
            corpname:string;
            usesubcorp:string;
            humanCorpname:string;
        }

        type Component = React.SFC<Props>;

    }

    namespace Shortener {

        interface Props {
            text:string;
            limit?:number;
            className?:string;
        }

        type Component = React.SFC<Props>;
    }

    // -------------------------------

    interface Runtime {
        ModalOverlay: ModalOverlay.Component;
        PopupBox:PopupBox.Component;
        ImgWithMouseover:ImgWithMouseover.Component;
        CloseableFrame:CloseableFrame.Component;
        InlineHelp:InlineHelp.Component;
        Messages:Messages.Component;
        IssueReportingLink:IssueReportingLink.Component;
        AjaxLoaderImage:AjaxLoaderImage.Component;
        AjaxLoaderBarImage:AjaxLoaderBarImage.Component;
        CorpnameInfoTrigger:CorpnameInfoTrigger.Component;
        Shortener:Shortener.Component;
    }
}


