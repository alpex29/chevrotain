var chevrotain = require("chevrotain");

// ----------------- lexer -----------------
var extendToken = chevrotain.extendToken;
var Lexer = chevrotain.Lexer;
var Parser = chevrotain.Parser;

// using the NA pattern marks this Token class as 'irrelevant' for the Lexer.
// AdditionOperator defines a Tokens hierarchy but only leafs in this hierarchy define
// actual Tokens that can appear in the text
var AdditionOperator = extendToken("AdditionOperator", Lexer.NA);
var Plus = extendToken("Plus", /\+/, AdditionOperator);
var Minus = extendToken("Minus", /-/, AdditionOperator);

var MultiplicationOperator = extendToken("MultiplicationOperator", Lexer.NA);
var Multi = extendToken("Multi", /\*/, MultiplicationOperator);
var Div = extendToken("Div", /\//, MultiplicationOperator);

var LParen = extendToken("LParen", /\(/);
var RParen = extendToken("RParen", /\)/);
var NumberLiteral = extendToken("NumberLiteral", /[1-9]\d*/);
var WhiteSpace = extendToken("WhiteSpace", /\s+/);
WhiteSpace.GROUP = Lexer.SKIPPED; // marking WhiteSpace as 'SKIPPED' makes the lexer skip it.

var allTokens = [WhiteSpace, // whitespace is normally very common so it should be placed first to speed up the lexer's performance
    Plus, Minus, Multi, Div, LParen, RParen, NumberLiteral, AdditionOperator, MultiplicationOperator];
var CalculatorLexer = new Lexer(allTokens);


// ----------------- parser -----------------
function Calculator(input) {
    Parser.call(this, input, allTokens);

    var $ = this;

    $.RULE("expression", function() {
        return $.SUBRULE($.additionExpression)
    });

    //  lowest precedence thus it is first in the rule chain
    // The precedence of binary expressions is determined by how far down the Parse Tree
    // The binary expression appears.
    $.RULE("additionExpression", function() {
        var value, op, rhsVal;

        // parsing part
        value = $.SUBRULE($.multiplicationExpression);
        $.MANY(function() {
            // consuming 'AdditionOperator' will consume either Plus or Minus as they are subclasses of AdditionOperator
            op = $.CONSUME(AdditionOperator);
            //  the index "2" in SUBRULE2 is needed to identify the unique position in the grammar during runtime
            rhsVal = $.SUBRULE2($.multiplicationExpression);

            // interpreter part
            if (op instanceof Plus) {
                value += rhsVal
            } else { // op instanceof Minus
                value -= rhsVal
            }
        });

        return value
    });


    $.RULE("multiplicationExpression", function() {
        var value, op, rhsVal;

        // parsing part
        value = $.SUBRULE($.atomicExpression);
        $.MANY(function() {
            op = $.CONSUME(MultiplicationOperator);
            //  the index "2" in SUBRULE2 is needed to identify the unique position in the grammar during runtime
            rhsVal = $.SUBRULE2($.atomicExpression);

            // interpreter part
            if (op instanceof Multi) {
                value *= rhsVal
            } else { // op instanceof Div
                value /= rhsVal
            }
        });

        return value
    });


    $.RULE("atomicExpression", function() {
        // @formatter:off
            return $.OR([
                // parenthesisExpression has the highest precedence and thus it appears
                // in the "lowest" leaf in the expression ParseTree.
                {ALT: function(){ return $.SUBRULE($.parenthesisExpression)}},
                {ALT: function(){ return parseInt($.CONSUME(NumberLiteral).image, 10)}}
            ], "a number or parenthesis expression");
            // @formatter:on
    });

    $.RULE("parenthesisExpression", function() {
        var expValue;

        $.CONSUME(LParen);
        expValue = $.SUBRULE($.expression);
        $.CONSUME(RParen);

        return expValue
    });

    // very important to call this after all the rules have been defined.
    // otherwise the parser may not work correctly as it will lack information
    // derived during the self analysis phase.
    Parser.performSelfAnalysis(this);
}

// avoids inserting number literals as these can have multiple(and infinite) semantic values, thus it is unlikely
// we can choose the correct number value to insert.
Calculator.prototype.canTokenTypeBeInsertedInRecovery = function(tokClass) {
    return tokClass !== NumberLiteral
};

Calculator.prototype = Object.create(Parser.prototype);
Calculator.prototype.constructor = Calculator;


// wrapping it all togater
// reuse the same parser instance.
var parser = new Calculator([]);

module.exports = function(text) {
    var lexResult = CalculatorLexer.tokenize(text);
    // setting a new input will RESET the parser instance's state.
    parser.input = lexResult.tokens;
    // any top level rule may be used as an entry point
    var value = parser.expression();

    return {
        value:       value,
        lexResult:   lexResult,
        parseErrors: parser.errors
    };
};