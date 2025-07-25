/*
 * Copyright (c) 2015 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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
import { IActionDispatcher, BoundWithProps } from 'kombo';

import * as Kontext from '../../types/kontext.js';
import * as CoreViews from '../../types/coreViews/index.js';
import { MessageModel, MessageModelState } from '../../models/common/layout.js';
import { Actions } from '../../models/common/actions.js';
import { init as calendarInit } from './calendar.js';
import { init as kwicRangeInit } from './kwicRange.js';
import { init as toggleSwitchInit } from './toggle/index.js';
import { init as responsiveInit } from './responsiveWrapper.js';
import { ImgWithMouseover } from './general.js';
import * as S from './style.js';


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
    const ResponsiveWrapper = responsiveInit(he);

    // ------------------------------ <ErrorBoundary /> -----------------------------

    class ErrorBoundary extends React.Component<{children?: React.ReactNode}, {hasError:boolean}> {

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
                    <S.ErrorBoundary>
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
                    </S.ErrorBoundary>
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
            if (evt.key === Keyboard.Value.ESC && typeof this.props.onCloseKey === 'function') {
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
                <S.ModalOverlay style={style}>
                    {this.props.children}
                </S.ModalOverlay>
            );
        }
    }

    // ------------------------------ <StatusIcon /> -----------------------------

    const StatusIcon:CoreViews.StatusIcon.Component = (props) => {
        const m = {
            info: 'img/info-icon.svg',
            mail: 'img/envelope.svg',
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
    const PopupBox:React.FC<CoreViews.PopupBox.Props> = (props) => {

        // CoreViews.PopupBox.State

        const closeBtnRef = React.useRef(null);
        const selfRef = React.useRef(null);

        const resize = props.autoWidth ?
        () => {
            if (selfRef) {
                const elm = selfRef.current;
                if (elm) {
                    elm.style.minWidth = '5em';
                    elm.style.overflow = 'auto';
                    elm.style.width = `${(calcAutoWidth(this.props.autoWidth)).toFixed()}px`;
                }
            }
        } :
        ()=>undefined;


        React.useEffect(
            () => {
                if (props.takeFocus) {
                    const btnElm = closeBtnRef.current;
                    btnElm.focus();
                }
                if (props.onReady) {
                    const rootElm = selfRef.current;
                    props.onReady(rootElm);
                }
                window.addEventListener('resize', windowResizeHandler);
                return () => {
                    window.removeEventListener('resize', windowResizeHandler);
                }
            },
            []
        );

        React.useEffect(() => {
            if (props.takeFocus) {
                const elmBtn = closeBtnRef.current;
                if (elmBtn) {
                    elmBtn.focus();
                }
            }
        });

        const windowResizeHandler = () => {
            resize();
        }

        const closeClickHandler = () => {
            if (typeof props.onCloseClick === 'function') {
                props.onCloseClick.call(this);
            }
        };

        const handleKeyPress = (evt:React.KeyboardEvent) => {
            if (evt.key === Keyboard.Value.ESC) {
                    closeClickHandler();
                    evt.stopPropagation();
            }
            if (typeof props.keyPressHandler === 'function') {
                props.keyPressHandler(evt);
            }
        };

        const handleAreaClick = (evt:React.MouseEvent):void => {
            const targetElm = evt.target as HTMLElement;
            const isInteractiveActive = (elm:HTMLElement) =>
                ['INPUT', 'SELECT', 'BUTTON', 'A', 'LABEL', 'TEXTAREA'].indexOf(elm.nodeName) > -1 ||
                elm.getAttribute('tabindex') !== null;
            if (!isInteractiveActive(targetElm)) {
                const sel = window.getSelection();
                if (sel.anchorOffset === sel.focusOffset) { // <- prevents Firefox from resetting the selection
                    closeBtnRef.current.focus();
                }
                if (props.onAreaClick) {
                    props.onAreaClick();
                }
            }
        }

        const classes = ['tooltip-box'];
        if (props.customClass) {
            classes.push(props.customClass);
        }

        return (
            <S.TooltipBox className={classes.join(' ')} style={props.customStyle} ref={resize}
                    onClick={handleAreaClick}
                    onKeyDown={handleKeyPress}>
                <div className="header">
                    <button type="button" className="close-link"
                            onClick={closeClickHandler}
                            onKeyDown={handleKeyPress}
                            ref={closeBtnRef}
                            title={he.translate('global__click_or_esc_to_close')} />
                    <StatusIcon status={props.status} />
                </div>
                {props.children}
            </S.TooltipBox>
        );
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

    const CloseableFrame:React.FC<CoreViews.CloseableFrame.Props> = (props) => {

        const ref = React.useRef(null);

        const resizeFn:(evt:UIEvent)=>any = props.autoWidth ?
            (evt) => {
                if (ref) {
                    const elm = ref.current;
                    if (elm) {
                        elm.style.overflow = 'auto';
                        elm.style.width = `${(calcAutoWidth(props.autoWidth)).toFixed()}px`;
                    }
                }
            } :
            (evt:UIEvent) => undefined;

        const closeClickHandler = () => {
            if (typeof props.onCloseClick === 'function') {
                props.onCloseClick();
            }
        }

        const windowResizeHandler = () => {
            const elm = ref.current;
            if (elm) {
                resizeFn(elm);
            }
        }

        React.useEffect(() => {
                window.addEventListener('resize', resizeFn);
                if (props.onReady) {
                    const elm = ref.current;
                    if (elm) {
                        props.onReady(elm);
                    }
                }
                return () => {
                    window.removeEventListener('resize', windowResizeHandler);
                }
            },
            []
        );

        const htmlClass = 'closeable-frame' + (props.customClass ? ` ${props.customClass}` : '');

        return (
            <S.CloseableFrame className={htmlClass} ref={ref} $fixedTop="5%">
                <div className="heading">
                    {props.icon ?
                        <span className="icon">{props.icon}</span> : null}
                    <h2>
                        {props.label}
                    </h2>
                    <div className="control">
                        {props.onHelpClick ?
                            <ImgWithMouseover src={he.createStaticUrl('img/question-mark.svg')}
                                    clickHandler={props.onHelpClick}
                                    alt={he.translate('global__help')}
                                    role="button"
                                    tabIndex={0}
                                        /> :
                            null
                        }
                        <ImgWithMouseover htmlClass="close-icon"
                                src={he.createStaticUrl('img/close-icon.svg')}
                                src2={he.createStaticUrl('img/close-icon_s.svg')}
                                clickHandler={closeClickHandler}
                                alt={he.translate('global__close_the_window')}
                                role="button"
                                tabIndex={0} />
                    </div>
                </div>
                {props.customControls ?
                    <div className="custom-controls">
                        <div className="buttons">
                            {props.customControls}
                        </div>
                    </div> :
                    null
                }
                <div className="contents" style={props.scrollable ? {overflow: 'auto'} : {}}>
                    <div className="padded-contents">
                        {props.children}
                    </div>
                </div>
            </S.CloseableFrame>
        );
    }

    // ------------------------------ <InlineHelp /> -----------------------------

    const InlineHelp:React.FC<CoreViews.InlineHelp.Props> = (props) => {

        const [state, changeState] = React.useState<CoreViews.InlineHelp.State>({helpVisible: false});

        const clickHandler = () => {
            changeState({helpVisible: !state.helpVisible});
        };

        const renderLink = () => {
            const label = props.isWarning ?
                he.translate('global__click_to_see_more_info') :
                he.translate('global__click_to_see_help');
            return (
                <a className="context-help" onClick={clickHandler}
                            title={label}>
                    <ImgWithMouseover
                        htmlClass="over-img"
                        src={he.createStaticUrl(props.isWarning ? 'img/warning-icon.svg' : 'img/question-mark.svg')}
                        src2={he.createStaticUrl(props.isWarning ? 'img/warning-icon.svg' : 'img/question-mark_s.svg')}
                        alt={label} />
                </a>
            );
        };

        return (
            <S.InlineHelp className={props.htmlClass ? props.htmlClass : undefined}>
                {props.noSuperscript ?
                    <span>{renderLink()}</span> :
                    <sup>{renderLink()}</sup>
                }
                {state.helpVisible ?
                        <PopupBox onCloseClick={clickHandler}
                                customStyle={props.customStyle ? props.customStyle : null}>
                            {props.children}
                            {props.url ?
                                <div className="link">
                                    <hr />
                                    <a href={props.url} target='_blank'>
                                        {he.translate('global__get_more_info')}
                                    </a>
                                </div> : null}
                        </PopupBox>
                        : null}
            </S.InlineHelp>
        );
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
                <S.Abbrevation title={he.translate('global__click_to_see_def')} >
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
                </S.Abbrevation>
            );
        }
    }


    // ------------------------------ <Message /> -----------------------------

    const Message:React.FC<CoreViews.Message.Props> = (props) => {

        const handleCloseClick = (e) => {
            e.preventDefault();
            dispatcher.dispatch<typeof Actions.MessageClose>({
                name: Actions.MessageClose.name,
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
                    <div className="icon-box">
                        <img className="icon" alt="message"
                                src={ typeIconMap[props.messageType] } />
                    </div>
                    <div className="message-text">
                        <span>{props.messageText}</span>
                    </div>
                    <div className="button-box">
                        <a className="close-icon">
                            <img src={he.createStaticUrl('img/close-icon.svg')}
                                onClick={handleCloseClick} />
                        </a>
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

    const Messages:React.FC<CoreViews.Messages.Props & MessageModelState> = (props) => {

        React.useEffect(props.initCallback, []);

        return List.empty(props.messages) ?
            null :
            <S.MessagesDiv>
                {props.messages.map((item, i) => (
                    <Message key={`msg:${i}`} {...item} />
                ))}
            </S.MessagesDiv>
    };

    // ------------------------ <CorpnameInfoTrigger /> --------------------------------

    const CorpnameInfoTrigger:React.FC<CoreViews.CorpnameInfoTrigger.Props> = (props) => {

        const handleCorpnameClick = () => {
            dispatcher.dispatch<typeof Actions.OverviewCorpusInfoRequired>({
                name: Actions.OverviewCorpusInfoRequired.name,
                payload: {
                    corpusId: props.corpname
                }
            });
        };

        const handleSubcnameClick = () => {
            dispatcher.dispatch<typeof Actions.OverviewShowSubcorpusInfo>({
                name: Actions.OverviewShowSubcorpusInfo.name,
                payload: {
                    corpusId: props.corpname,
                    subcorpusId: props.usesubcorp
                }
            });
        };

        const renderSubcorp = () => {
            if (props.usesubcorp) {
                return (
                    <>
                        {'\u00a0'}<strong>/</strong>{'\u00a0'}
                        <a className={`subcorpus${props.foreignSubcorp ? ' foreign' : ''}`} title={he.translate('global__subcorpus')}
                                    onClick={handleSubcnameClick}>
                            <strong>{props.subcName}</strong>
                        </a>
                        <span title={he.translate('global__public_subc_id_{id}', {id: props.usesubcorp})}>
                            {'\u00a0'}
                            {props.foreignSubcorp ?
                            <span>({he.translate('global__published_foreign_subcorp')})</span> : null
                            }
                        </span>
                    </>
                );

            } else {
                return null;
            }
        };

        return (
            <S.CorpnameInfoTriggerLI>
                <strong>{he.translate('global__corpus')}:{'\u00a0'}</strong>
                <a className="corpus-desc" title="click for details"
                            onClick={handleCorpnameClick}>
                    {props.humanCorpname}
                </a>
                {renderSubcorp()}
            </S.CorpnameInfoTriggerLI>
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
            {props.text.length > limit ? props.text.substring(0, props.limit) + '\u2026' : props.text}
        </span>;
    };

    // ------------------------------------------------------------------------------------

    const DelItemIcon:React.FC<CoreViews.DelItemIcon.Props> = (props) => {
        return <S.DelItemIconA className={`${props.disabled ? 'disabled' : ''} ${props.className}`}
                        onClick={props.onClick && !props.disabled ? props.onClick : undefined}
                        title={props.title}>
                    <ImgWithMouseover src={he.createStaticUrl('img/garbage_can.svg')}
                            alt={props.title ? props.title : "garbage can"} />
                </S.DelItemIconA>;
    };

    // ------------------------------------------------------------------------------------

    const ConfIcon:React.FC<CoreViews.ConfIcon.Props> = (props) => {
        return <S.ConfIconA className={`${props.disabled ? 'disabled' : ''} ${props.className}`}
                        onClick={props.onClick && !props.disabled ? props.onClick : undefined}
                        title={props.title}>
                    <ImgWithMouseover src={he.createStaticUrl('img/config-icon.svg')}
                            alt={props.title ? props.title : "config"} />
                </S.ConfIconA>;
    };

    // ------------------------------------------------------------------------------------

    const ValidatedItem:CoreViews.ValidatedItem.Component = (props) => {
        const cls:Array<string> = [];
        if (props.htmlClass) {
            cls.push(props.htmlClass);
        }
        if (props.invalid) {
            cls.push('invalid')
        }
        return <S.ValidatedItem className={cls.join(' ')}>
            {props.children}
            {props.errorDesc ? <><br /><span className="error-desc">{props.errorDesc}</span></> : null}
        </S.ValidatedItem>;
    };

    // ----------------------- <TabButton /> ------------------------------------------------------

    /**
     * This button is used along with [ul.tabs li] as a tab-like sub-forms and control
     * panels.
     */
    const TabButton:CoreViews.TabButton.Component = (props) => {
        const btnCls = props.isDisabled ? 'util-button disabled' : 'util-button';
        const cls = props.htmlClass ? `${btnCls} ${props.htmlClass}` : btnCls;
        return <S.TabButton>
                <button type="button" className={cls} onClick={props.onClick} disabled={props.isDisabled}>
                    {props.label}
                </button>
                <br />
                <span className={props.isActive ? 'underline' : 'underline hidden'}> </span>
            </S.TabButton>;
    };

    // ----------------- <TabView /> ---------------------------------------------

    const TabView:CoreViews.TabView.Component = (props) => {

        const render = (activeIndex:number, setActiveIndex:(i:number)=>void) => {
            const tabs = List.map(
                (value, index) => (
                    <li key={value.id}>
                        <TabButton
                            label={value.label}
                            isActive={index === activeIndex}
                            onClick={() => setActiveIndex(index)}
                            isDisabled={value.isDisabled} />
                    </li>
                ),
                props.items
            );
            return <div>
                <ul className={[props.className, 'tabs'].join(' ')}>{tabs}</ul>
                {props.noButtonSeparator ? null : <hr />}
                {props.children[activeIndex]}
            </div>;
        }

        if (props.items.length === 1) {
            return <div>{props.children[0]}</div>

        } else if (props.noInternalState) {
            return render(
                props.items.findIndex(item => item.id===props.defaultId) || 0,
                (idx:number) => props.callback(props.items[idx].id)
            );

        } else {
            const [activeIndex, setActiveIndex] = React.useState(
                props.defaultId ? props.items.findIndex(item => item.id===props.defaultId) : 0);
            return render(
                activeIndex,
                (idx:number) => {
                    if (props.callback) {
                        props.callback(props.items[idx].id);
                    }
                    setActiveIndex(idx);
                }
            );
        }
    };

    // ---------------------------- <PlusButton /> ------------------------------------------

    const PlusButton:CoreViews.PlusButton.Component = (props) => {
        const cls = props.htmlClass ? 'PlusButton util-button ' + props.htmlClass : 'PlusButton util-button';
        return <S.PlusButton type="button" className={cls} title={props.mouseOverHint}
                    onClick={props.onClick}>
                    <img src={he.createStaticUrl('img/plus.svg')} />
                </S.PlusButton>;
    }

    // -------------------------- <ExpandButton /> ----------------------------------------

    const ExpandButton:CoreViews.ExpandButton.Component = (props) => {
        return (
            <S.ExpandButton type="button" className={`ExpandButton${props.onClick ? '' : ' readonly'}`}
                    onClick={props.onClick ? () => props.onClick(props.isExpanded) : null}>
                {props.isExpanded ?
                    <ImgWithMouseover src={he.createStaticUrl('img/minus.svg')} alt="minus" /> :
                    <ImgWithMouseover src={he.createStaticUrl('img/plus.svg')} alt="plus" />
                }
            </S.ExpandButton>
        );
    };

    // -------------------------- <ExpandableArea /> ---------------------------------

    const ExpandableArea:CoreViews.ExpandableArea.Component = (props) => {

        const [isExpanded, setExpanded] = React.useState(props.initialExpanded);

        const handleClick = () => {
            setExpanded(!isExpanded);
        };

        return (
            <S.ExpandableAreaDiv className={props.alwaysExpanded ? ' readonly' : ''}>
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
            </S.ExpandableAreaDiv>
        );
    }

    // -------------------------- <UnsupportedRenderer /> ---------------------------------

    const UnsupportedRenderer:CoreViews.UnsupportedRenderer.Component = (props) => {

        return (
            <S.UnsupportedRenderer>
                {props.children}
            </S.UnsupportedRenderer>
        );
    }

    // -------------------------- <SimplePaginator /> ---------------------------------

    const SimplePaginator:CoreViews.SimplePaginator.Component = (props) => {

        const [value, setValue] = React.useState(props.currentPage);
        React.useEffect(() => {
            setValue(props.currentPage);
        }, [props.currentPage]);

        const handleKeyPress = (evt) => {
            if (evt.key === Keyboard.Value.ENTER) {
                props.handlePageChange(evt.target.value);
                evt.preventDefault();
                evt.stopPropagation();
            }
        };

        const renderPageNum = () => {
            if (props.isLoading) {
                return <div>
                        <span className="overlay">
                            <img src={he.createStaticUrl('img/ajax-loader-bar.gif')}
                                alt={he.translate('global__loading')} />
                        </span>
                        <input type="text" />
                </div>;

            } else {
                return (
                    <input type="text" value={value}
                        title={he.translate('global__curr_page_num')}
                        onKeyDown={handleKeyPress}
                        onChange={e => setValue(e.target.value)}
                        disabled={props.totalPages === 1}
                        style={{width: '3em'}} />
                );
            }
        };

        return (
            <S.SimplePaginator>
                <div className="ktx-pagination-core">
                    <div className="ktx-pagination-left">
                        {parseInt(props.currentPage) > 1 ?
                            (<a onClick={(e) => props.handlePageChange(`${parseInt(props.currentPage)-1}`)}>
                                <img className="over-img" src={he.createStaticUrl('img/prev-page.svg')}
                                        alt={he.translate('global__prev_page_btn')} />
                            </a>) : null}
                    </div>
                    <span className="curr-page">{renderPageNum()}</span>
                    <span className="num-of-pages">{'\u00a0/\u00a0'}{props.totalPages}</span>
                    <div className="ktx-pagination-right">
                        {parseInt(props.currentPage) < props.totalPages ?
                            (<a onClick={(e) => props.handlePageChange(`${parseInt(props.currentPage)+1}`)}>
                                <img className="over-img" src={he.createStaticUrl('img/next-page.svg')}
                                        alt={he.translate('global__next_page_btn')} />
                            </a>) : null}
                    </div>
                </div>
            </S.SimplePaginator>
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
        Messages: BoundWithProps<CoreViews.Messages.Props, MessageModelState>(Messages, messageModel),
        CorpnameInfoTrigger,
        ImgWithHighlight,
        ImgWithMouseover,
        IssueReportingLink,
        AjaxLoaderImage,
        AjaxLoaderBarImage,
        Shortener,
        StatusIcon,
        DelItemIcon,
        ConfIcon,
        ValidatedItem,
        TabButton,
        TabView,
        PlusButton,
        Calendar,
        ExpandButton,
        ExpandableArea,
        FadeInFrame,
        KwicRangeSelector,
        ToggleSwitch,
        UnsupportedRenderer,
        ResponsiveWrapper,
        SimplePaginator
    };
}
