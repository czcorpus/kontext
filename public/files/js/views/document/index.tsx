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

import { Keyboard, Client, List } from 'cnc-tskit';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IActionDispatcher, BoundWithProps } from 'kombo';

import { Kontext } from '../../types/common';
import { CoreViews } from '../../types/coreViews';
import { MessageModel, MessageModelState } from '../../models/common/layout';
import { Actions, ActionName } from '../../models/common/actions';
import { init as calendarInit } from './calendar';
import { init as kwicRangeInit } from './kwicRange';
import { init as toggleSwitchInit } from './toggle';
import { ImgWithMouseover } from './general';


const calcAutoWidth = (val:CoreViews.AutoWidth|undefined):number => {
    if (Client.isMobileTouchDevice()) {
        return window.innerWidth;

    } else if (val === CoreViews.AutoWidth.NARROW) {
        return window.innerWidth / 2.618;

    } else if (val === CoreViews.AutoWidth.WIDE) {
        return window.innerWidth / 1.618;

    } else {
        throw new Error('Cannot calc auto-width - no valid value provided');
    }
}


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    messageModel:MessageModel

):CoreViews.Runtime {

    const Calendar = calendarInit(he);
    const KwicRangeSelector = kwicRangeInit(he);
    const ToggleSwitch = toggleSwitchInit(he);

    // ------------------------------ <ErrorBoundary /> -----------------------------

    class ErrorBoundary extends React.Component<{}, {hasError:boolean}> {

        constructor(props) {
            super(props);
            this.state = {hasError: false};
        }

        componentDidCatch(err, info) {
            console.error(err);
            this.setState({hasError: true});
        }

        render() {
            if (this.state.hasError) {
                return (
                    <div className="ErrorBoundary">
                        <p className="message">
                            <img src={he.createStaticUrl('img/error-icon.svg')}
                                    alt={he.translate('global__error_icon')}
                                    style={{width: '1.5em'}} />
                            {he.translate('global__failed_to_render_component')}
                        </p>
                        <p className="symbol">
                            <img src={he.createStaticUrl('img/gear.svg')}
                                    style={{width: '4em'}} />
                        </p>
                        <p className="note">
                            {he.translate('global__failed_to_render_component_expl')}
                        </p>
                    </div>
                );
            }
            return this.props.children;
        }
    }

    // ------------------------------ <ModalOverlay /> -----------------------------

    class ModalOverlay extends React.Component<CoreViews.ModalOverlay.Props, CoreViews.ModalOverlay.State> {

        constructor(props) {
            super(props);
            this._keyPressHandler = this._keyPressHandler.bind(this);
        }

        _keyPressHandler(evt) {
            if (evt.keyCode === Keyboard.Code.ESC && typeof this.props.onCloseKey === 'function') {
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

    // ------------------------------ <StatusIcon /> -----------------------------

    const StatusIcon:CoreViews.StatusIcon.Component = (props) => {
        const m = {
            info: 'img/info-icon.svg',
            message: 'img/message-icon.png',
            warning: 'img/warning-icon.svg',
            error: 'img/error-icon.svg'
        };

        const renderImg = () => {
            if (props.status && m[props.status]) {
                return <img className="info-icon" src={he.createStaticUrl(m[props.status])}
                            alt={props.status} />;
            }
            return null;
        };

        if (props.inline) {
            return (
                <span className={props.htmlClass ? props.htmlClass : null}>
                    {renderImg()}
                </span>
            );

        } else {
            return (
                <div className={props.htmlClass ? props.htmlClass : 'icon-box'}>
                    {renderImg()}
                </div>
            );
        }
    };


    // ------------------------------ <PopupBox /> -----------------------------

    /**
     * A general PopupBox for displaying overlay information. The box
     * is not modal but in can be wrapped in <ModalOverlay />
     * component to get modal box/window.
     */
    class PopupBox extends React.Component<CoreViews.PopupBox.Props, CoreViews.PopupBox.State> {

        private rootElm:HTMLElement;

        private resize:(ref:HTMLElement)=>void;

        private closeBtnRef:React.RefObject<HTMLButtonElement>;

        constructor(props) {
            super(props);
            this._handleKeyPress = this._handleKeyPress.bind(this);
            this._closeClickHandler = this._closeClickHandler.bind(this);
            this._windowResizeHandler = this._windowResizeHandler.bind(this);
            this._handleAreaClick = this._handleAreaClick.bind(this);
            this.closeBtnRef = React.createRef();

            if (this.props.autoWidth) {
                this.resize = (ref) => {
                    if (ref) {
                        this.rootElm = ref;
                        this.rootElm.style.minWidth = '5em';
                        this.rootElm.style.overflow = 'auto';
                        this.rootElm.style.width = `${(calcAutoWidth(this.props.autoWidth)).toFixed()}px`;
                    }
                }

            } else {
                this.resize = (_)=>undefined;
            }
        }

        private _windowResizeHandler():void {
            this.resize(this.rootElm);
        }

        componentDidMount() {
            if (this.props.takeFocus) {
                this.closeBtnRef.current.focus();
            }
            if (this.props.onReady) {
                this.props.onReady(ReactDOM.findDOMNode(this) as HTMLElement);
            }
            window.addEventListener('resize', this._windowResizeHandler);
        }

        componentWillUnmount() {
            window.removeEventListener('resize', this._windowResizeHandler);
        }

        _closeClickHandler() {
            if (typeof this.props.onCloseClick === 'function') {
                this.props.onCloseClick.call(this);
            }
        }

        _handleKeyPress(evt:React.KeyboardEvent) {
            if (evt.keyCode === Keyboard.Code.ESC) {
                 this._closeClickHandler();
                 evt.stopPropagation();
            }
            if (typeof this.props.keyPressHandler === 'function') {
                this.props.keyPressHandler(evt);
            }
        }

        _handleAreaClick(evt:React.MouseEvent):void {
            const targetElm = evt.target as HTMLElement;
            const isInteractiveActive = (elm:HTMLElement) =>
                ['INPUT', 'SELECT', 'BUTTON', 'A', 'LABEL', 'TEXTAREA'].indexOf(elm.nodeName) > -1 ||
                elm.getAttribute('tabindex') !== null;
            if (!isInteractiveActive(targetElm)) {
                const sel = window.getSelection();
                if (sel.anchorOffset === sel.focusOffset) { // <- prevents Firefox from resetting the selection
                    this.closeBtnRef.current.focus();
                }
                if (this.props.onAreaClick) {
                    this.props.onAreaClick();
                }
            }
        }

        render() {
            const classes = ['tooltip-box'];
            if (this.props.customClass) {
                classes.push(this.props.customClass);
            }

            return (
                <div className={classes.join(' ')} style={this.props.customStyle} ref={this.resize}
                        onClick={this._handleAreaClick}
                        onKeyDown={this._handleKeyPress}>
                    <div className="header">
                        <button type="button" className="close-link"
                                onClick={this._closeClickHandler}
                                onKeyDown={this._handleKeyPress}
                                ref={this.closeBtnRef}
                                title={he.translate('global__click_or_esc_to_close')} />
                        <StatusIcon status={this.props.status} />
                    </div>
                    {this.props.children}
                </div>
            );
        }
    }

    // ------------------------------ <ImgWithHighlight /> -----------------------------

    const ImgWithHighlight:CoreViews.ImgWithHighlight.Component = (props) => {

        const mkAltSrc = (s) => {
            const tmp = s.split('.');
            return `${tmp.slice(0, -1).join('.')}_s.${tmp[tmp.length - 1]}`;
        };

        const src2 = props.src2 ? props.src2 : mkAltSrc(props.src);
        return <img className={props.htmlClass}
                    src={props.isHighlighted ? src2 : props.src}
                    alt={props.alt}
                    title={props.alt}
                    style={props.style ? props.style : null} />;
    };

    // ------------------------------ <CloseableFrame /> -----------------------------

    class CloseableFrame extends React.PureComponent<CoreViews.CloseableFrame.Props> {

        private resizeFn:(elm:HTMLElement)=>void;

        private rootElm:HTMLElement;

        constructor(props) {
            super(props);
            this.closeClickHandler = this.closeClickHandler.bind(this);
            this.windowResizeHandler = this.windowResizeHandler.bind(this);
            this.resizeFn = this.props.autoWidth ?
                (ref) => {
                    if (ref) {
                        this.rootElm = ref;
                        this.rootElm.style.overflow = 'auto';
                        this.rootElm.style.width = `${(calcAutoWidth(this.props.autoWidth)).toFixed()}px`;
                    }
                } :
                (_) => undefined;
        }

        private closeClickHandler() {
            if (typeof this.props.onCloseClick === 'function') {
                this.props.onCloseClick();
            }
        }

        private windowResizeHandler() {
            this.resizeFn(this.rootElm);
        }

        componentDidMount() {
            window.addEventListener('resize', this.windowResizeHandler);
            if (this.props.onReady) {
                this.props.onReady(ReactDOM.findDOMNode(this) as HTMLElement);
            }
        }

        componentWillUnmount() {
            window.removeEventListener('resize', this.windowResizeHandler);
        }

        render() {
            const style = {
                width: '1.5em',
                height: '1.5em',
                float: 'right',
                cursor: 'pointer',
                fontSize: '1em'
            };

            const htmlClass = 'closeable-frame' + (this.props.customClass ? ` ${this.props.customClass}` : '');

            return (
                <section className={htmlClass} style={this.props.scrollable ? {overflowY: 'auto'} : {}}
                        ref={this.resizeFn}>
                    <div className="heading">
                        <div className="control">
                            <ImgWithMouseover htmlClass="close-icon"
                                    src={he.createStaticUrl('img/close-icon.svg')}
                                    src2={he.createStaticUrl('img/close-icon_s.svg')}
                                    clickHandler={this.closeClickHandler}
                                    alt={he.translate('global__close_the_window')} />
                        </div>
                        <h2>
                            {this.props.label}
                        </h2>
                    </div>
                    <div className="contents">
                        {this.props.children}
                    </div>
                </section>
            );
        }
    }

    // ------------------------------ <InlineHelp /> -----------------------------

    class InlineHelp extends React.Component<CoreViews.InlineHelp.Props, CoreViews.InlineHelp.State> {

        constructor(props) {
            super(props);
            this._clickHandler = this._clickHandler.bind(this);
            this.state = {helpVisible: false};
        }

        _clickHandler() {
            this.setState({helpVisible: !this.state.helpVisible});
        }

        _renderLink() {
            return <a className="context-help" onClick={this._clickHandler}
                        title={he.translate('global__click_to_see_help')}>
                <ImgWithMouseover
                        htmlClass="over-img"
                        src={he.createStaticUrl('img/question-mark.svg')}
                        alt={he.translate('global__click_to_see_help')} />
            </a>;
        }

        render() {
            return (
                <span className="InlineHelp">
                    {this.props.noSuperscript ?
                        <span>{this._renderLink()}</span> :
                        <sup>{this._renderLink()}</sup>
                    }
                    {this.state.helpVisible ?
                            <PopupBox onCloseClick={this._clickHandler}
                                    customStyle={this.props.customStyle}>
                                {this.props.children}
                                {this.props.url ?
                                    <div className="link">
                                        <hr />
                                        <a href={this.props.url} target='_blank'>
                                            {he.translate('global__get_more_info')}
                                        </a>
                                    </div> : null}
                            </PopupBox>
                            : null}
                </span>
            );
        }
    }

    // ------------------------------ <Abbreviation /> -----------------------------------

    class Abbreviation extends React.Component<CoreViews.Abbreviation.Props, {helpVisible:boolean}> {

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
                <span className="Abbreviation" title={he.translate('global__click_to_see_def')} >
                    <abbr onClick={this._clickHandler}>
                        {this.props.value}
                    </abbr>
                    {this.state.helpVisible ?
                            <PopupBox onCloseClick={this._clickHandler}
                                    customStyle={this.props.customStyle}>
                                <strong>{this.props.value}</strong> = {this.props.desc}
                                {this.props.url ?
                                    <div className="link">
                                        <hr />
                                        <a className="external" href={this.props.url} target='_blank'>
                                            {he.translate('global__get_more_info')}
                                        </a>
                                    </div> : null}
                            </PopupBox>
                            :
                        null
                    }
                </span>
            );
        }
    }


    // ------------------------------ <Message /> -----------------------------

    const Message:React.FC<CoreViews.Message.Props> = (props) => {

        const handleCloseClick = (e) => {
            e.preventDefault();
            dispatcher.dispatch<Actions.MessageClose>({
                name: ActionName.MessageClose,
                payload: {
                    messageId: props.messageId
                }
            });
        };

        const typeIconMap = {
            info: he.createStaticUrl('img/info-icon.svg'),
            warning: he.createStaticUrl('img/warning-icon.svg'),
            error: he.createStaticUrl('img/error-icon.svg'),
            mail: he.createStaticUrl('img/message-icon.png')
        };

        const calcOpacity = () => {
            return Math.min(1, props.ttl / props.timeFadeout);
        };

        return (
            <FadeInFrame opacity={calcOpacity()}>
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

    const FadeInFrame:React.FC<CoreViews.FadeInFrame.Props> = (props) => {

        return (
            <div style={{opacity: props.opacity}}>
                {props.children}
            </div>
        );
    };

    // ------------------------------ <Messages /> -----------------------------

    const Messages:React.FC<CoreViews.Messages.Props & MessageModelState> = (props) => (

        List.empty(props.messages) ?
            null :
            <div className="messages">
                {props.messages.map((item, i) => (
                    <Message key={`msg:${i}`} {...item} />
                ))}
            </div>
    );

    // ------------------------ <CorpnameInfoTrigger /> --------------------------------

    const CorpnameInfoTrigger:React.FC<CoreViews.CorpnameInfoTrigger.Props> = (props) => {

        const handleCorpnameClick = () => {
            dispatcher.dispatch<Actions.OverviewCorpusInfoRequired>({
                name: ActionName.OverviewCorpusInfoRequired,
                payload: {
                    corpusId: props.corpname
                }
            });
        };

        const handleSubcnameClick = () => {
            dispatcher.dispatch<Actions.OverviewShowSubcorpusInfo>({
                name: ActionName.OverviewShowSubcorpusInfo,
                payload: {
                    corpusId: props.corpname,
                    subcorpusId: props.usesubcorp
                }
            });
        };

        const getSubcName = () => {
            if (props.origSubcorpName && props.origSubcorpName !== props.usesubcorp) {
                return <>
                    <a className={`subcorpus${props.foreignSubcorp ? ' foreign' : ''}`} title={he.translate('global__subcorpus')}
                                        onClick={handleSubcnameClick}>
                        <strong>{props.origSubcorpName}</strong>
                    </a>
                    <span title={he.translate('global__public_subc_id_{id}', {id: props.usesubcorp})}>
                        {'\u00a0'}({props.foreignSubcorp ? he.translate('global__published_foreign_subcorp') : he.translate('global__published_subcorp')})
                    </span>
                </>;

            } else {
                return <a className="subcorpus" title={he.translate('global__subcorpus')}
                                        onClick={handleSubcnameClick}>
                        <strong>{props.usesubcorp}</strong>
                    </a>;
            }
        };

        const renderSubcorp = () => {
            if (props.usesubcorp) {
                return (
                    <>
                        {'\u00a0'}<strong>/</strong>{'\u00a0'}
                        {getSubcName()}
                    </>
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

    const IssueReportingLink:React.FC<CoreViews.IssueReportingLink.Props> = (props) => {
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

    const AjaxLoaderImage:React.FC<CoreViews.AjaxLoaderImage.Props> = (props) => {
        return <img
                    className={props.htmlClass ? props.htmlClass : undefined}
                    src={he.createStaticUrl('img/ajax-loader.gif')}
                    alt={he.translate('global__loading')}
                    title={props.title} />;
    };

    // ------------------------ <AjaxLoaderBarImage /> --------------------------------

    const AjaxLoaderBarImage:React.FC<CoreViews.AjaxLoaderBarImage.Props> = (props) => {
        return <img
                className={props.htmlClass ? props.htmlClass : undefined}
                src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                alt={he.translate('global__loading')}
                title={props.title} />;
    };

    // ------------------------------------------------------------------------------------

    const Shortener:React.FC<CoreViews.Shortener.Props> = (props) => {
        const limit = props.limit ? props.limit : 50;
        return <span title={props.text.length > limit ? props.text : null} className={props.className}>
            {props.text.length > limit ? props.text.substr(0, props.limit) + '\u2026' : props.text}
        </span>;
    };

    // ------------------------------------------------------------------------------------

    const DelItemIcon:React.FC<CoreViews.DelItemIcon.Props> = (props) => {
        return <a className={`DelItemIcon ${props.disabled ? 'disabled' : ''} ${props.className}`}
                        onClick={props.onClick && !props.disabled ? props.onClick : undefined}
                        title={props.title}>
                    <ImgWithMouseover src={he.createStaticUrl('img/garbage_can.svg')}
                            alt={props.title ? props.title : "garbage can"} />
                </a>;
    };

    // ------------------------------------------------------------------------------------

    const ValidatedItem:CoreViews.ValidatedItem.Component = (props) => {
        return <span className={`ValidatedItem${props.invalid ? ' invalid' : ''}`}>
            {props.children}
            {props.errorDesc ? <><br /><span className="error-desc">{props.errorDesc}</span></> : null}
        </span>;
    };

    // ----------------------- <TabButton /> ------------------------------------------------------

    /**
     * This button is used along with [ul.tabs li] as a tab-like sub-forms and control
     * panels.
     */
    const TabButton:CoreViews.TabButton.Component = (props) => {
        const cls = props.htmlClass ? 'util-button ' + props.htmlClass : 'util-button';
        return <span className="TabButton">
                <button type="button" className={cls} onClick={props.onClick}>
                    {props.label}
                </button>
                <br />
                <span className={props.isActive ? 'underline' : 'underline hidden'}> </span>
            </span>;
    };

    // ----------------- <TabView /> ---------------------------------------------

    const TabView:CoreViews.TabView.Component = (props) => {
        if (props.items.length === 1) {
            return <div>{props.children[0]}</div>
        } else {
            const [activeIndex, setActiveIndex] = React.useState(props.defaultId ? props.items.findIndex(item => item.id===props.defaultId) : 0);
            const tabs = props.items.map((value, index) =>
                <li key={value.id}>
                    <TabButton
                        label={value.label}
                        isActive={index === activeIndex}
                        onClick={() => {
                            if (props.callback) {
                                props.callback(value.id);
                            }
                            setActiveIndex(index);
                        }}/>
                </li>
            );
            return <div>
                <ul className={[props.className, 'tabs'].join(' ')}>{tabs}</ul>
                <hr />
                {props.children[activeIndex]}
            </div>;
        }
    };

    // ---------------------------- <PlusButton /> ------------------------------------------

    const PlusButton:CoreViews.PlusButton.Component = (props) => {
        const cls = props.htmlClass ? 'PlusButton util-button ' + props.htmlClass : 'PlusButton util-button';
        return <button type="button" className={cls} title={props.mouseOverHint}
                    onClick={props.onClick}>
                    <img src={he.createStaticUrl('img/plus.svg')} />
                </button>;
    }

    // -------------------------- <ExpandButton /> ----------------------------------------

    const ExpandButton:CoreViews.ExpandButton.Component = (props) => {
        return (
            <button type="button" className={`ExpandButton${props.onClick ? '' : ' readonly'}`}
                    onClick={props.onClick ? () => props.onClick(props.isExpanded) : null}>
                {props.isExpanded ? <span>-</span> : <span>+</span>}
            </button>
        );
    };

    // -------------------------- <ExpandableArea /> ---------------------------------

    const ExpandableArea:CoreViews.ExpandableArea.Component = (props) => {

        const [isExpanded, setExpanded] = React.useState(props.initialExpanded);

        const handleClick = () => {
            setExpanded(!isExpanded);
        };

        return (
            <div className={`ExpandableArea${props.alwaysExpanded ? ' readonly' : ''}`}>
                <div className="controls">
                    <ExpandButton isExpanded={isExpanded}
                        onClick={props.alwaysExpanded ? undefined : handleClick} />
                    {
                        props.alwaysExpanded ?
                        <span>{props.label}</span> :
                        <a onClick={handleClick}>{props.label}</a>
                    }
                </div>
                {isExpanded ? props.children : null}
            </div>
        );
    }

    // ------------------------------------------------------------------------------------

    return {
        ErrorBoundary,
        ModalOverlay,
        PopupBox,
        CloseableFrame,
        InlineHelp,
        Abbreviation,
        Messages: BoundWithProps<CoreViews.Message.Props, MessageModelState>(Messages, messageModel),
        CorpnameInfoTrigger,
        ImgWithHighlight,
        ImgWithMouseover,
        IssueReportingLink,
        AjaxLoaderImage,
        AjaxLoaderBarImage,
        Shortener,
        StatusIcon,
        DelItemIcon,
        ValidatedItem,
        TabView,
        PlusButton,
        Calendar,
        ExpandButton,
        ExpandableArea,
        KwicRangeSelector,
        ToggleSwitch
    };
}
