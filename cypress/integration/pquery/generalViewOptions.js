/// <reference types="cypress" />


describe('Paradigmatic query vs. general view options', () => {

    beforeEach(() => {
        cy.actionLogin();
    });

    afterEach(() => {
        cy.actionLogout();
    });

    it('defines a query using separate sub-queries, submits, changes min freq. and re-evaluates', () => {

        // set page size to 5
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetPquery table input[type="text"]').clear().type(5);
        cy.get('#view-options-mount div.buttons button').click();


        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);

        cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="e.*"]');
        cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
        cy.get('#pquery-form-mount .submit').click();

        // test result page
        cy.url({timeout: 8000}).should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 5);
        cy.get('#pquery-result-mount .controls .num-input').contains('/ 11');

        // set page size to 20
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetPquery table input[type="text"]').clear().type(20);
        cy.get('#view-options-mount div.buttons button').click();

        // test result page
        cy.url({timeout: 8000}).should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 20);
        cy.get('#pquery-result-mount .controls .num-input').contains('/ 3');

    });

});