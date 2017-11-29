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

/// <reference path="../types/common.d.ts" />
/// <reference path="../vendor.d.ts/react.d.ts" />


import * as React from 'vendor/react';
import * as ReactDOM from 'vendor/react-dom';


export function init(dispatcher:Kontext.FluxDispatcher, he:Kontext.ComponentHelpers, storeProvider:any):Kontext.LayoutViews { // TODO type

    // ------------------------------ <ModalOverlay /> -----------------------------

    interface ModalOverlayProps {
        onCloseKey:()=>void;
        isScrollable:boolean;
        children:React.ReactElement;
    }

    interface ModalOverlayState {
    }

    class ModalOverlay extends React.Component<ModalOverlayProps, ModalOverlayState> {

        constructor(props) {
            super(props);
            this._keyPressHandler = this._keyPressHandler.bind(this);
        }

        _keyPressHandler(evt) {
            if (evt.keyCode === 27 && typeof this.props.onCloseKey === 'function') {
                this.props.onCloseKey();
            }
        }

        componentDidMount() {
            he.addGlobalKeyEventHandler(this._keyPressHandler);
        }

        componentWillUnmount() {
            he.removeGlobalKeyEventHandler(this._keyPressHandler);
        }

        render() {
            const style = {};
            if (this.props.isScrollable) {
                style['overflow'] = 'auto';
            }
            return (
                <div id="modal-overlay" style={style}>
                    {this.props.children}
                </div>
            );
        }
    }


    // ------------------------------ <PopupBox /> -----------------------------

    interface PopupBoxProps {

        /**
         * a custom action to be performed once the component is mounted
         */
        onReady:(elm:HTMLElement)=>void;

        /**
         * a custom action to be performed when user clicks 'close'
         */
        onCloseClick:()=>void;

        status:string;

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
        keyPressHandler:(evt:React.SyntheticEvent)=>void;

        customClass:string;

        autoSize:boolean;

        children:Array<React.ReactElement>;
    }

    interface PopupBoxState {}

    /**
     * A general PopupBox for displaying overlay information. The box
     * is not modal but in can be wrapped in <ModalOverlay />
     * component to get modal box/window.
     */
    class PopupBox extends React.Component<PopupBoxProps, PopupBoxState> {

        constructor(props) {
            super(props);
            this._handleKeyPress = this._handleKeyPress.bind(this);
            this._closeClickHandler = this._closeClickHandler.bind(this);
        }

        componentDidMount() {
            if (this.props.onReady) {
                this.props.onReady(ReactDOM.findDOMNode(this));
            }
        }

        _closeClickHandler() {
            if (typeof this.props.onCloseClick === 'function') {
                this.props.onCloseClick.call(this);
            }
        }

        _renderStatusIcon() {
            const m = {
                info: 'img/info-icon.svg',
                message: 'img/message-icon.png',
                warning: 'img/warning-icon.svg',
                error: 'img/error-icon.svg'
            };
            if (!this.props.status || !m[this.props.status]) {
                return null;

            } else {
                return (
                    <div>
                        <img className="info-icon" src={he.createStaticUrl(m[this.props.status])}
                                alt={this.props.status} />
                    </div>
                );
            }
        }

        _createStyle() {
            let css = {};
            for (let p in this.props.customStyle) {
                if (this.props.customStyle.hasOwnProperty(p)) {
                    css[p] = this.props.customStyle[p];
                }
            }
            return css;
        }

        _handleKeyPress(evt) {
            if (evt.keyCode === 27) {
                 this._closeClickHandler();
            }
            if (typeof this.props.keyPressHandler === 'function') {
                this.props.keyPressHandler(evt);
            }
            evt.preventDefault();
            evt.stopPropagation();
        }

        _renderCloseButton() {
             if (this.props.takeFocus) {
                return <button className="close-link"
                            onClick={this._closeClickHandler}
                            onKeyDown={this._handleKeyPress}
                            ref={item => item ? item.focus() : null} />;

             } else {
                 return <button type="button" className="close-link"
                            onClick={this._closeClickHandler}
                            onKeyDown={this._handleKeyPress} />;
             }
        }

        render() {
            const classes = ['tooltip-box'];
            if (this.props.customClass) {
                classes.push(this.props.customClass);
            }
            const css = this._createStyle();
            if (this.props.autoSize) {
                css['width'] = '31.9%';
            }

            return (
                <div className={classes.join(' ')} style={css}>
                    <div className="header">
                        {this._renderCloseButton()}
                        {this._renderStatusIcon()}
                    </div>
                    {this.props.children}
                </div>
            );
        }
    }

    // ------------------------------ <ImgWithMouseover /> -----------------------------

    interface ImgWithMouseoverProps {
        src:string;
        src2?:string;
        htmlClass:string;
        clickHandler:()=>void;
        alt:string;
    }

    interface ImgWithMouseoverState {
        isMouseover:boolean;
    }

    class ImgWithMouseover extends React.Component<ImgWithMouseoverProps, ImgWithMouseoverState> {

        constructor(props) {
            super(props);
            this._handleCloseMouseover = this._handleCloseMouseover.bind(this);
            this._handleCloseMouseout = this._handleCloseMouseout.bind(this);
            this.state = {isMouseover : false};
        }

        _handleCloseMouseover() {
            this.setState({isMouseover: true});
        }

        _handleCloseMouseout() {
            this.setState({isMouseover: false});
        }

        _mkAltSrc(s) {
            const tmp = s.split('.');
            return `${tmp.slice(0, -1).join('.')}_s.${tmp[tmp.length - 1]}`;
        }

        render() {
            const src2 = this.props.src2 ? this.props.src2 : this._mkAltSrc(this.props.src);
            return <img className={this.props.htmlClass}
                        src={this.state.isMouseover ? src2 : this.props.src}
                        onClick={this.props.clickHandler}
                        alt={this.props.alt}
                        title={this.props.alt}
                        onMouseOver={this._handleCloseMouseover}
                        onMouseOut={this._handleCloseMouseout}  />;
        }
    }

    // ------------------------------ <CloseableFrame /> -----------------------------

    interface CloseableFrameProps {
        onCloseClick:()=>void;
        customClass:string;
        scrollable:boolean;
        label:string;
        children:Array<React.ReactElement>;
    }

    const CloseableFrame:React.FuncComponent<CloseableFrameProps> = (props) => {

        const closeClickHandler = () => {
            if (typeof props.onCloseClick === 'function') {
                props.onCloseClick();
            }
        };
        const style = {
            width: '1.5em',
            height: '1.5em',
            float: 'right',
            cursor: 'pointer',
            fontSize: '1em'
        };
        const htmlClass = 'closeable-frame' + (props.customClass ? ` ${props.customClass}` : '');
        return (
            <section className={htmlClass} style={props.scrollable ? {overflowY: 'auto'} : {}}>
                <div className="heading">
                    <div className="control">
                        <ImgWithMouseover htmlClass="close-icon"
                                src={he.createStaticUrl('img/close-icon_s.svg')}
                                src2={he.createStaticUrl('img/close-icon.svg')}
                                clickHandler={closeClickHandler}
                                alt={he.translate('global__close_the_window')} />
                    </div>
                    <h2>
                        {props.label}
                    </h2>
                </div>
                {props.children}
            </section>
        );
    };

    // ------------------------------ <InlineHelp /> -----------------------------

    interface InlineHelpProps {
        customStyle:string;
        children:Array<React.ReactElement>;
    }

    interface InlineHelpState {
        helpVisible:boolean;
    }

    class InlineHelp extends React.Component<InlineHelpProps, InlineHelpState> {

        constructor(props) {
            super(props);
            this._clickHandler = this._clickHandler.bind(this);
            this.state = {helpVisible: false};
        }

        _clickHandler() {
            this.setState({helpVisible: !this.state.helpVisible});
        }

        render() {
            return (
                <span>
                    <sup style={{display: 'inline-block'}}>
                        <a className="context-help" onClick={this._clickHandler}>
                            <ImgWithMouseover
                                    htmlClass="over-img"
                                    src={he.createStaticUrl('img/question-mark.svg')} />
                        </a>
                    </sup>
                    {this.state.helpVisible ?
                            <PopupBox onCloseClick={this._clickHandler}
                                    customStyle={this.props.customStyle}>
                                {this.props.children}
                            </PopupBox>
                            : null}
                </span>
            );
        }
    }


    // ------------------------------ <Message /> -----------------------------
    // (info/error/warning message box)

    interface MessageProps {
        messageId:string;
        fadingOut:boolean;
        transitionTime:number;
        messageType:string;
        messageText:string;
    }

    const Message:React.FuncComponent<MessageProps> = (props) => {

        const handleCloseClick = (e) => {
            e.preventDefault();
            he.delayHandler(
                () => {
                    dispatcher.dispatch({
                        actionType: 'MESSAGE_FADE_OUT_ITEM',
                        props: {
                            messageId: props.messageId
                        }
                    });
                },
                () => {
                    dispatcher.dispatch({
                        actionType: 'MESSAGE_CLOSED',
                        props: {
                            messageId: props.messageId
                        }
                    });
                },
                500
            );
        };

        const typeIconMap = {
            info: he.createStaticUrl('img/info-icon.svg'),
            warning: he.createStaticUrl('img/warning-icon.svg'),
            error: he.createStaticUrl('img/error-icon.svg'),
            mail: he.createStaticUrl('img/message-icon.png')
        };

        return (
            <FadeInFrame transitionName="msganim" mode={props.fadingOut ? 'fadeout' : 'fadein'}
                    transitionTime={props.transitionTime}>
                <div className={'message ' + props.messageType}>
                    <div className="button-box">
                        <a className="close-icon">
                            <img src={he.createStaticUrl('img/close-icon.svg')}
                                onClick={handleCloseClick} />
                        </a>
                    </div>
                    <div className="icon-box">
                        <img className="icon" alt="message"
                                src={ typeIconMap[props.messageType] } />
                    </div>
                    <div className="message-text">
                        <span>{props.messageText}</span>
                    </div>
                </div>
            </FadeInFrame>
        );
    };

    // ------------------------------ <FadeInFrame /> -----------------------------

    interface FadeInFrameProps {
        mode:string;
        transitionTime:number;
        children:Array<React.ReactElement>;
    }

    interface FadeInFrameState {
        opacity:number;
    }

    class FadeInFrame extends React.Component<FadeInFrameProps, FadeInFrameState> {

        constructor(props) {
            super(props);
            this._handleAnimationEnd = this._handleAnimationEnd.bind(this);
            this.state = {opacity: this.props.mode === 'fadein' ? 0 : 1};
        }

        _handleAnimationEnd() {
            this.setState({opacity: 1 - this.state.opacity});
        }


        render() {
            const style = {
                animationDuration: `${this.props.transitionTime}ms`,
                animationName: this.props.mode,
                animationIterationCount: 1,
                opacity: this.state.opacity.toFixed(1)
            };
            return (
                <div style={style} onAnimationEnd={this._handleAnimationEnd}>
                    {this.props.children}
                </div>
            );
        }
    }

    // ------------------------------ <Messages /> -----------------------------

    interface MessagesProps {

    }

    interface MessagesState {
        messages:any; // TODO type
        transitionTime:number;
    }

    class Messages extends React.Component<MessagesProps, MessagesState> {

        constructor(props) {
            super(props);
            this._changeListener = this._changeListener.bind(this);
            this.state = {
                messages: storeProvider.messageStore.getMessages(),
                transitionTime: storeProvider.messageStore.getTransitionTime()
            };
        }

        _changeListener() {
            this.setState({
                messages: storeProvider.messageStore.getMessages(),
                transitionTime: storeProvider.messageStore.getTransitionTime()
            });
        }

        componentDidMount() {
            storeProvider.messageStore.addChangeListener(this._changeListener);
        }

        componentWillUnmount() {
            storeProvider.messageStore.removeChangeListener(this._changeListener);
        }

        render() {
            if (this.state.messages.size > 0) {
                return (
                    <div className="messages">
                        {this.state.messages.map((item, i) => (
                            <Message key={`msg:${i}`} transitionTime={this.state.transitionTime} {...item} />
                        ))}
                    </div>
                );

            } else {
                return null;
            }
        }
    }

    // ------------------------ <CorpnameInfoTrigger /> --------------------------------

    interface CorpnameInfoTriggerProps {
        corpname:string;
        usesubcorp:string;
        humanCorpname:string;
    }

    const CorpnameInfoTrigger:React.FuncComponent<CorpnameInfoTriggerProps> = (props) => {

        const handleCorpnameClick = () => {
            dispatcher.dispatch({
                actionType: 'OVERVIEW_CORPUS_INFO_REQUIRED',
                props: {
                    corpusId: props.corpname
                }
            });
        };

        const handleSubcnameClick = () => {
            dispatcher.dispatch({
                actionType: 'OVERVIEW_SHOW_SUBCORPUS_INFO',
                props: {
                    corpusId: props.corpname,
                    subcorpusId: props.usesubcorp
                }
            });
        };

        const renderSubcorp = () => {
            if (props.usesubcorp) {
                return (
                    <span>
                        <strong>:</strong>
                        <a className="subcorpus" title={he.translate('global__subcorpus')}
                                    onClick={handleSubcnameClick}>
                            {props.usesubcorp}
                        </a>
                    </span>
                );

            } else {
                return null;
            }
        };

        return (
            <li id="active-corpus">
                <strong>{he.translate('global__corpus')}:{'\u00a0'}</strong>
                <a className="corpus-desc" title="click for details"
                            onClick={handleCorpnameClick}>
                    {props.humanCorpname}
                </a>
                {renderSubcorp()}
            </li>
        );
    };

    // ------------------------ <IssueReportingLink /> --------------------------------

    interface IssueReportingLinkProps {
        url:string;
        blank_window:boolean;
        type:string;
        label:string;
        onClick:()=>void;
    }

    const IssueReportingLink:React.FuncComponent<IssueReportingLinkProps> = (props) => {
        if (props.type === 'static') {
            return (
                <a href={props.url} target={props.blank_window ? '_blank' : '_self'}
                        rel={props.blank_window ? 'noopener noreferrer' : null}>
                    {props.label}
                </a>
            );

        } else {
            return (
                <a onClick={props.onClick}>
                    {props.label}
                </a>
            );
        }
    };

    // ------------------------ <AjaxLoaderImage /> --------------------------------

    interface AjaxLoaderImageProps {}

    const AjaxLoaderImage:React.FuncComponent<AjaxLoaderImageProps> = (props) => {
        return <img src={he.createStaticUrl('img/ajax-loader.gif')} alt={he.translate('global__loading')} />;
    };

    // ------------------------ <AjaxLoaderBarImage /> --------------------------------

    interface AjaxLoaderBarImageProps {}

    const AjaxLoaderBarImage:React.FuncComponent<AjaxLoaderBarImageProps> = (props) => {
        return <img src={he.createStaticUrl('img/ajax-loader-bar.gif')} alt={he.translate('global__loading')} />;
    };


    // ------------------------------------------------------------------------------------

    return {
        ModalOverlay: ModalOverlay,
        PopupBox: PopupBox,
        CloseableFrame: CloseableFrame,
        InlineHelp: InlineHelp,
        Messages: Messages,
        CorpnameInfoTrigger: CorpnameInfoTrigger,
        ImgWithMouseover: ImgWithMouseover,
        IssueReportingLink: IssueReportingLink,
        AjaxLoaderImage: AjaxLoaderImage,
        AjaxLoaderBarImage: AjaxLoaderBarImage
    };
}
