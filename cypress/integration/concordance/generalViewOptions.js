/// <reference types="cypress" />


describe('Concordance - general view options', () => {

    beforeEach(() => {
        cy.viewport(1600, 1200);
        cy.visit('http://localhost:8080/query?corpname=susanne');
    });

    it('tests displaying and closing general option', () => {
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount').should('not.be.empty');
        cy.get('#view-options-mount img.close-icon').click();
        cy.get('#view-options-mount').should('be.empty');
    });

    it('tests page size option', () => {
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();
        cy.url().should('include', '/view');

        // check default page size
        cy.get('#conc-dashboard-mount table tbody tr').should('have.length', 40);

        // set page size to 10
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetConcordance .tst-conc-page-size').clear().type(10);
        cy.get('#view-options-mount div.buttons button').click();

        // check new page size
        cy.get('#conc-dashboard-mount table tbody tr').should('have.length', 10);
    });

    it('tests page size option', () => {
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();
        cy.url().should('include', '/view');

        // check default kwic size
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.lc').children().should('have.length', 10);
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.rc').children().should('have.length', 10);

        // set kwic size to 5
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetConcordance .tst-conc-kwic-size').clear().type(5);
        cy.get('#view-options-mount div.buttons button').click();

        // check new kwic size
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.lc').children().should('have.length', 5);
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.rc').children().should('have.length', 5);
    });

    it('tests line numbers', () => {
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();
        cy.url().should('include', '/view');

        // check default line numbers options
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(1) td.line-num').should('contain.text', '');
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(2) td.line-num').should('contain.text', '');
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(3) td.line-num').should('contain.text', '');

        // turn on line numbers
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetConcordance label[for="show-line-numbers-input"]').click();
        cy.get('#view-options-mount div.buttons button').click();

        // check new line numbers options
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(1) td.line-num').should('contain.text', '1');
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(2) td.line-num').should('contain.text', '2');
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(3) td.line-num').should('contain.text', '3');
    });

    it('tests line shuffle', () => {
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();
        cy.url().should('include', '/view');

        // line shuffeling
        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);
        cy.get('#view-options-mount .FieldsetConcordance label[for="always-shuffle"]').click();
        cy.get('#view-options-mount div.buttons button').click();

        // take value of first left kwic
        cy.get('#conc-dashboard-mount table tbody tr:nth-child(1) td.lc').invoke('text').then(text => {
            // run new query
            cy.hoverNthMenuItem(1);
            cy.clickMenuItem(1, 1);
            cy.get('.simple-input').type('and');
            cy.get('.query .default-button').click();
            cy.url().should('include', '/view');

            // check new line numbers options
            cy.get('#conc-dashboard-mount table tbody tr:nth-child(1) td.lc').should('not.have.text', text);
        });
    });

});