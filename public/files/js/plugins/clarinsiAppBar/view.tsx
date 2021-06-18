/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import { Bound, IActionDispatcher } from 'kombo';
import { Kontext } from '../../types/common';
import * as React from 'react';
import * as S from './style';
import * as GS from './global-style';
import flagSI from './flag-si.svg';
import flagCS from './flag-cs.svg';
import flagUK from './flag-uk.svg';
import { ActionName, Actions, ClarinSiAppBarModel } from './model';


export function init(
    dispatcher:IActionDispatcher,
    he:Kontext.ComponentHelpers,
    toolbarModel:ClarinSiAppBarModel) {

    const handleLangClick = (value:string) => () => {
        dispatcher.dispatch<Actions.SetLanguage>({
            name: ActionName.SetLanguage,
            payload: {
                value
            }
        });
    };

    const handleMenuToggleClick = () => {
        dispatcher.dispatch<Actions.ToggleMenu>({
            name: ActionName.ToggleMenu
        });
    };

    const Widget:React.FC<{menuVisible:boolean}> = (props) => {
        return (
            <S.Widget>
                <GS.GlobalStyle />
                <div className="buttons">
                    <ul className="localization-bar">
                        <li>
                            <a className="flag flag-si" onClick={handleLangClick('sl-SI')}>
                                <img src={flagSI} title="Slovenščina" style={{width: '24px', height: '12px'}} />
                            </a>
                        </li>
                        <li>
                            <a className="flag flag-en" onClick={handleLangClick('en-US')}>
                                <img src={flagUK} title="English" style={{width: '24px', height: '12px'}} />
                            </a>
                        </li>
                        <li>
                            <a className="flag flag-cs"  onClick={handleLangClick('cs-CZ')}>
                                <img src={flagCS} title="Czech" style={{width: '24px', height: '12px'}} />
                            </a>
                        </li>
                    </ul>
                    <div className="lindat-auth-bar"></div>
                </div>
                <nav className="lindat-common" role="navigation" data-version="1.5.0" data-build="d73d463931712e2fc9c875a0a4673dae1c4e26cb">
                    <button type="button" className="lindat-menu-btn" onClick={handleMenuToggleClick}>
                        <span className="lindat-menu-icon">
                        <span className="lindat-icon-bar"> </span>
                        <span className="lindat-icon-bar"> </span>
                        <span className="lindat-icon-bar"> </span>
                        </span>
                    </button>
                    <ul className={`lindat-menu ${props.menuVisible ? ' lindat-open' : ''}`}>
                        <li className="lindat-home-item">
                        <a href="http://www.clarin.si/" className="clarin-si-logo"><span></span></a>
                        </li>
                        <li className="lindat-repository-item">
                        <a href="https://www.clarin.si/repository/xmlui/?locale-attribute=en"><span>Repository</span></a>
                        </li>
                        <li className="lindat-about-item">
                        <a href="http://www.clarin.si/info/about-repository/"><span>About</span></a>
                        </li>
                        <li id="lindat-about-item">
                        <a href="http://www.clarin.si/info/contact/"><span>Contact</span></a>
                        </li>
                        <li className="lindat-clarin-menu">
                        <a href="http://www.clarin.eu" className="clarin-logo"><span>CLARIN</span></a>
                        </li>
                    </ul>
                </nav>
            </S.Widget>
        );
    }

    return Bound(Widget, toolbarModel);

}


