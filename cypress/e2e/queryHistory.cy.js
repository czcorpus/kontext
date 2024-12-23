/// <reference types="cypress" />


describe('Query History', () => {

    const createTestSubcorpus = () => {
        cy.get('#query-form-mount')
        .then($mount => {
            let options = $mount.find('#subcorp-selector option').filter(':contains("test-subc")');
            if (!options.length) {
                // open create subcorpus
                cy.hoverNthMenuItem(2);
                cy.clickMenuItem(2, 4);

                // create subcorpus from text type
                cy.get('#subcorp-form-mount table.form .subcname input').type("test-subc");
                ["1"].forEach(v => {
                    cy.get('#subcorp-form-mount div.data-sel div.grid > div input[type=checkbox]').check(v);
                });
                cy.get('#subcorp-form-mount p.submit-buttons').contains('button', 'Create subcorpus').click();     
            }
        });
    }

    // fill in some history items
    before(() => {
        cy.actionLogin();
        createTestSubcorpus();

        // concordance query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.url().should('contain', '/query?');
        cy.get('#subcorp-selector').select('test-subc');
        cy.get('.simple-input').type('London');
        cy.get('.query .default-button').click();
        cy.url().should('contain', '/view?');

        // another concordance query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.url().should('contain', '/query?');
        cy.get('#subcorp-selector').select('--whole corpus--');
        cy.get('.simple-input').type('the');
        cy.get('.DefaultAttrSelect').select("lemma");
        cy.get('#section-specify-text-types button.ExpandButton').click();
        cy.get('.specify-text-types div.grid > div input[type=checkbox]').check("1");
        cy.get('.specify-text-types div.grid > div input[type=checkbox]').check("maj");
        cy.get('.query .default-button').click();
        cy.url().should('contain', '/view?');

        // paradigmatic query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 2);
        cy.url().should('contain', '/pquery/index?');
        cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="e.*"]');
        cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
        cy.get('#pquery-form-mount .submit').click();
        cy.url({timeout: 10000}).should('contain', '/pquery/result?');

        // word list query
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);
        cy.url().should('contain', '/wordlist/form?');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wordlist-form-mount .default-button').click();
        cy.url().should('contain', '/wordlist/result?');
                    
        // keywords
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 4);
        cy.url().should('contain', '/keywords/form?');
        cy.get('#kw-pattern').clear().type('.*ing');
        cy.get('#keywords-form-mount .default-button').click();
        cy.url().should('contain', '/keywords/result?');
        
        cy.actionLogout();
    });

    beforeEach(() => {
        cy.actionLogin();

        // open query history modal from menu
        cy.hoverNthMenuItem(1);
        cy.openHistory();
    });

    afterEach(() => {
        cy.closeMessages();
        cy.closeHistory();
        cy.actionLogout();
    });

    it('tests opening and closing history', () => {
        cy.get('#query-history-mount').should('not.be.empty');
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount').should('not.be.empty');
        cy.get('#query-history-mount').contains('button', 'Quick search').click();
        cy.get('#query-history-mount').should('not.be.empty');
        cy.closeHistory();
        cy.get('#query-history-mount').should('be.empty');
        cy.openHistory();
    });

    it('tests supertype filter in quick search', () => {
        // test any supertype
        let history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');
        history.should('contain.text', 'keywords');

        // test concordance supertype
        cy.get('#query-history-mount fieldset.basic select').select('concordance');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'keywords');

        // test paradigmatic query supertype
        cy.get('#query-history-mount fieldset.basic select').select('paradigmatic query');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'keywords');

        // test word list supertype
        cy.get('#query-history-mount fieldset.basic select').select('word list');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('contain.text', 'word list');
        history.should('not.contain.text', 'keywords');

        // test keywords supertype
        cy.get('#query-history-mount fieldset.basic select').select('keywords');
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'word list');
        history.should('contain.text', 'keywords');
    });

    it('tests supertype filter in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        
        // test any supertype
        cy.get('#query-history-mount select').first().select('any');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        let history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');
        history.should('contain.text', 'keywords');

        // test concordance supertype
        cy.get('#query-history-mount select').first().select('concordance');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('contain.text', 'concordance');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'keywords');

        // test word list supertype
        cy.get('#query-history-mount select').first().select('word list');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('not.contain.text', 'concordance');
        history.should('contain.text', 'word list');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'keywords');

        // test paradigmatic query supertype
        cy.get('#query-history-mount select').first().select('paradigmatic query');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'word list');
        history.should('contain.text', 'paradigmatic query');
        history.should('not.contain.text', 'keywords');

        // test keywords supertype
        cy.get('#query-history-mount select').first().select('keywords');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        history = cy.get('#query-history-mount .history-entries .supertype');
        history.should('not.be.empty');
        history.should('not.contain.text', 'concordance');
        history.should('not.contain.text', 'word list');
        history.should('not.contain.text', 'paradigmatic query');
        history.should('contain.text', 'keywords');
    });

    it('tests archive filter in quick search', () => {
        // check nothing is archived
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
        cy.get('#query-history-mount fieldset label').eq(2).click();

        // open tools and archive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools input[type="text"]').type('first-archived-item');
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();

        // check there are archived items
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('not.be.empty');

        // open tools and dearchive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
    });

    it('tests archive filter in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        // check nothing is archived
        cy.get('#query-history-mount input').eq(0).type('first-archived-item');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
        cy.get('#query-history-mount input').eq(0).clear();
        cy.get('#query-history-mount').contains('button', 'Search').click();

        // open tools and archive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools input[type="text"]').type('first-archived-item');
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();

        // check there are archived items
        cy.get('#query-history-mount input').eq(0).type('first-archived-item');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount fieldset label').eq(2).click();
        cy.get('#query-history-mount .history-entries').should('not.be.empty');

        // open tools and dearchive
        cy.get('#query-history-mount .history-entries').children().first().find('.tools img').click();
        cy.get('#query-history-mount .history-entries').children().first().find('.tools button').eq(1).click();
        cy.get('#query-history-mount .history-entries').should('be.empty');
    });

    it('tests remove history item in quick and extended search', () => {
        // close history
        cy.closeHistory();

        // create new concordance query
        cy.get('.simple-input').type('history test query 1');
        cy.get('.query .default-button').click();
        cy.get('.query .default-button').should('be.visible');

        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 1);
        cy.url().should('contain', '/query?');

        cy.get('.simple-input').type('history test query 2');
        cy.get('.query .default-button').click();
        cy.get('.query .default-button').should('be.visible');

        cy.wait(5000); // wait for saving queries to index

        // open history
        cy.openHistory();
        cy.get('#query-history-mount .history-entries').should('be.visible');

        // check quick search
        cy.get('#query-history-mount .history-entries').children().eq(1).should('contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').children().eq(0).should('contain.text', 'history test query 2');
        // check extended search
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').children().eq(1).should('contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').children().eq(0).should('contain.text', 'history test query 2');

        // delete from quick search
        cy.get('#query-history-mount').contains('button', 'Quick search').click();        
        cy.get('#query-history-mount .history-entries').children().eq(1).find('.tools img').click();
        cy.get('#query-history-mount .history-entries').find('.tools button').eq(0).click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('contain.text', 'history test query 2');

        // delete from extended search
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('contain.text', 'history test query 2');
        cy.get('#query-history-mount .history-entries').children().eq(0).find('.tools img').click();
        cy.get('#query-history-mount .history-entries').find('.tools button').eq(0).click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 2');

        // check extended search
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 2');
        
        // check quick search
        cy.get('#query-history-mount').contains('button', 'Quick search').click();
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 1');
        cy.get('#query-history-mount .history-entries').should('not.contain.text', 'history test query 2');
    });

    it('tests exact match and substring search in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        
        cy.get('#query-history-mount select').last().select('Any part of a query (exact match)');
        cy.get('#query-history-mount input').last().clear().type('London');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('not.contain.text', 'No data found.');

        cy.get('#query-history-mount input').last().clear().type('lond'); // TODO substring is case does not work
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount select').last().select('Any part of a query (substring)');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('not.contain.text', 'No data found.');
    });

    it('tests subcorpus search in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        
        cy.get('#query-history-mount input').eq(2).type('test-subc');
        cy.get('#query-history-mount').contains('button', 'Search').click();

        // test concordance subcorpus
        cy.get('#query-history-mount .history-entries .heading').each($item => {
            cy.wrap($item).should('contain.text', 'test-subc');
        });
    });

    it('tests concordance detailed search in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount select').first().select('concordance');
        cy.get('#query-history-mount #searchHistory_QueryCQLProps').check();
        cy.get('#query-history-mount input').eq(5).clear();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).type('London');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'London');
        });

        cy.get('#query-history-mount input').eq(4).clear().type('lon');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount select').eq(1).select('Token/position (substring)');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'London');
        });

        cy.get('#query-history-mount input').eq(4).clear();
        cy.get('#query-history-mount input').eq(5).clear().type('word');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'London');
        });

        cy.get('#query-history-mount input').eq(5).clear().type('lemma');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'the');
        });

        cy.get('#query-history-mount input').eq(5).clear();
        cy.get('#query-history-mount input').eq(6).type('maj');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'the');
        });

        cy.get('#query-history-mount input').eq(6).clear().type('m');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount select').eq(2).select('Text type (substring)');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'the');
        });

        cy.get('#query-history-mount input').eq(6).clear();
        cy.get('#query-history-mount input').eq(7).type('type');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'the');
        });

        cy.get('#query-history-mount input').eq(7).clear();
        cy.get('#query-history-mount input').eq(8).type('head');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li span.query').each($item => {
            cy.wrap($item).should('contain.text', 'the');
        });
    });

    it('tests pquery detailed search in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount select').first().select('paradigmatic query');
        cy.get('#query-history-mount #searchHistory_QueryCQLProps').check();
        cy.get('#query-history-mount input').eq(5).clear();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).type('e.*');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).clear().type('e');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount select').eq(1).select('Token/position (substring)');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).clear();
        cy.get('#query-history-mount input').eq(5).clear().type('word');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(5).clear().type('lemma');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount input').eq(5).clear().type('tag');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');
    });

    it('tests wlist detailed search in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount select').first().select('word list');
        cy.get('#query-history-mount #searchHistory_QueryCQLProps').check();
        cy.get('#query-history-mount input').eq(4).clear();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).type('pattern');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount input').eq(4).clear().type('.*ining');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).clear();
        cy.get('#query-history-mount input').eq(5).clear().type('lemma');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount input').eq(5).clear().type('word');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');
    });

    it('tests kwords detailed search in extended search', () => {
        cy.get('#query-history-mount').contains('button', 'Extended search').click();
        cy.get('#query-history-mount select').first().select('word list');
        cy.get('#query-history-mount #searchHistory_QueryCQLProps').check();
        cy.get('#query-history-mount input').eq(4).clear();
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');

        cy.get('#query-history-mount input').eq(4).type('lemma');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount').should('contain.text', 'No data found.');

        cy.get('#query-history-mount input').eq(4).clear().type('word');
        cy.get('#query-history-mount').contains('button', 'Search').click();
        cy.get('#query-history-mount .history-entries li').should('not.be.empty');
    });
});