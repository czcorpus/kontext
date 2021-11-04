/// <reference types="cypress" />


describe('Paradigmatic query', () => {

    before(() => {
        cy.actionLogin();
    });

    it('defines a query using separate sub-queries and submits', () => {
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 2);

        cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="e.*"]');
        cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
        cy.get('#pquery-form-mount button.add').click();
        cy.get('#pquery-form-mount .cql-input').eq(2).type('[tag="V.*"]');
        cy.get('#pquery-form-mount .submit').click();

        // test result page
        cy.url().should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 7);
        cy.get('#pquery-result-mount .data thead tr:nth-child(2) th:nth-child(9) a img.sort-flag').should('exist');

        // totals and pagination
        cy.get('#pquery-result-mount .controls p').contains('Total');
        cy.get('#pquery-result-mount .controls p').contains('7');
        cy.get('#pquery-result-mount .controls section a').should('have.length', 2);
        cy.get('#pquery-result-mount .controls section .num-input input').should('exist');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Paradigmatic query');

        // sort by value
        cy.get('#pquery-result-mount .data thead tr:nth-child(2) th:nth-child(2)').click();
        cy.get('#pquery-result-mount .data thead tr:nth-child(2) th:nth-child(2) a img.sort-flag')
            .should('exist')
            .and('include', '/sort-desc.svg');
    });

});