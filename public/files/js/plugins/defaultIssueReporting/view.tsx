/*
 * Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import {Kontext} from '../../types/common';
import { IssueReportingModel } from './init';
import { IActionDispatcher } from 'kombo';
import { Subscription } from 'rxjs';


export interface IssueReportingWidgetProps {

}


export interface Views {
    IssueReportingWidget:React.ComponentClass<IssueReportingWidgetProps>;
}


export function init(dispatcher:IActionDispatcher, he:Kontext.ComponentHelpers,
            reportingModel:IssueReportingModel):Views {

    const layoutViews = he.getLayoutViews();

    // -------------- <SubmitButton /> -------------------------------------

    const SubmitButton:React.SFC<{
        waitingForModel:boolean;

    }> = (props) => {

        const handleSubmitClick = () => {
            dispatcher.dispatch({
                name: 'ISSUE_REPORTING_SUBMIT_ISSUE',
                payload: {}
            });
        };

        if (props.waitingForModel) {
            return <img src={he.createStaticUrl('img/ajax-loader-bar.gif') }
                            title={he.translate('global__loading')} />;

        } else {
            return (
                <button type="button" className="default-button"
                        onClick={handleSubmitClick}>
                    {he.translate('defaultIR__submit_btn')}
                </button>
            );
        }
    };

    // -------------- <IssueReportingForm /> -------------------------------------

    const IssueReportingForm:React.SFC<{
        value:string;
        waitingForModel:boolean;
        closeClickHandler:()=>void;

    }> = (props) => {

        const handleTextareaChange = (evt) => {
            dispatcher.dispatch({
                name: 'ISSUE_REPORTING_UPDATE_ISSUE_BODY',
                payload: {value: evt.target.value}
            });
        };

        return (
            <layoutViews.ModalOverlay onCloseKey={props.closeClickHandler}>
                <layoutViews.CloseableFrame onCloseClick={props.closeClickHandler}
                        label={he.translate('defaultIR__report_issue_heading')}>
                    <form>
                        <textarea rows={10} cols={60} onChange={handleTextareaChange}
                                value={props.value} />
                        <p>
                            <SubmitButton waitingForModel={props.waitingForModel} />
                        </p>
                    </form>
                </layoutViews.CloseableFrame>
            </layoutViews.ModalOverlay>
        );
    };

    // -------------- <IssueReportingWidget /> -------------------------------------

    class IssueReportingWidget extends React.Component<IssueReportingWidgetProps, {
        formVisible:boolean;
        issueBody:string;
        waitingForModel:boolean;
    }> {

        private modelSubscription:Subscription;

        constructor(props) {
            super(props);
            this.state = this._fetchModelState();
            this._modelChangeHandler = this._modelChangeHandler.bind(this);
            this._handleLinkClick = this._handleLinkClick.bind(this);
            this._closeClickHandler = this._closeClickHandler.bind(this);
        }

        _fetchModelState() {
            return {
                formVisible: reportingModel.isActive(),
                issueBody: reportingModel.getIssueBody(),
                waitingForModel: reportingModel.isBusy()
            };
        }

        _modelChangeHandler() {
            this.setState(this._fetchModelState());
        }

        _handleLinkClick() {
            dispatcher.dispatch({
                name: 'ISSUE_REPORTING_SET_VISIBILITY',
                payload: {value: true}
            });
        }

        _closeClickHandler() {
            dispatcher.dispatch({
                name: 'ISSUE_REPORTING_SET_VISIBILITY',
                payload: {value: false}
            });
        }

        componentDidMount() {
            this.modelSubscription = reportingModel.addListener(this._modelChangeHandler);
        }

        componentWillUnmount() {
            this.modelSubscription.unsubscribe();
        }

        render() {
            return (
                <div>
                    <a onClick={this._handleLinkClick}>
                        {he.translate('defaultIR__report_issue_link')}
                    </a>
                    {this.state.formVisible ?
                        <IssueReportingForm closeClickHandler={this._closeClickHandler}
                            value={this.state.issueBody}
                            waitingForModel={this.state.waitingForModel} /> :
                        null
                    }
                </div>
            );
        }

    }


    return {
        IssueReportingWidget: IssueReportingWidget
    };

}