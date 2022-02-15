/// <reference types="cypress" />


describe('Initial testing experiments', () => {
    before(() => {
        cy.actionLogin();
    });

    after(() => {
        cy.actionLogout();
    });

    it('Logs in, creates a concordance and calculates freq. distrib. by lemmas', () => {
        cy.get('.query .options label[for="match-case-switch-susanne"]').click();
        cy.get('.simple-input').type('London');
        cy.get('.query .default-button').click();
        cy.url({timeout: 5000}).should('include', '/view');

        cy.hoverNthMenuItem(6);
        cy.clickMenuItem(6, 1);

        cy.url().should('include', '/freqs');
        const svgCharts = cy.get('#result-mount svg');
        svgCharts.should('be.visible');
        svgCharts.should('have.length', 1);
    })
  })