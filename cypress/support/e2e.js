/// <reference types="cypress" />


beforeEach(() => {
    cy.viewport(1600, 1200);
});

Cypress.Commands.add('actionLogin', () => {
    cy.viewport(1600, 1200);
    cy.visit('http://localhost:8080/query?corpname=susanne');
    cy.get('.user .sign-in').click();
    cy.get('.closeable-frame input[type="text"]').type('cypress');
    cy.get('.closeable-frame input[type="password"]').type('mypassword');
    cy.get('.closeable-frame button[type="submit"]').click();
});

Cypress.Commands.add('actionLogout', () => {
    cy.get('.user .logout').click();
});

Cypress.Commands.add('hoverNthMenuItem', (n) => {
});



Cypress.Commands.add('clickMenuItem', (m, n) => {
    const submenus = [
        'menu-new-query', 'menu-corpora', 'menu-save', 'menu-concordance', 'menu-filter',
        'menu-frequency', 'menu-collocations', 'menu-view', 'menu-help'
    ];
    cy.window().then((win) => {
        win.integrationTesting.showSubmenu(submenus[m-1]);
    });
    cy.get(`#main-menu-mount li:nth-child(${m}) .submenu li:nth-child(${n})`).should('be.visible').click();
});


Cypress.Commands.add('popUpNotifications', () => {
    cy.get('#main-menu-mount .notifications a.envelope').click();
});

Cypress.Commands.add('closeNotifications', () => {
    cy.get('.async-task-list .header button.close-link').click();
});

Cypress.Commands.add('openLastHistoryItem', () => {
    cy.hoverNthMenuItem(1);
    cy.clickMenuItem(1, 4);
    cy.get('#query-history-mount')
        .find('.history-entries')
        .should('not.be.empty', {'timeout': 5000})
        .children().first().click();
});
