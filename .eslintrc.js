module.exports = {
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "./tsconfig.json"
    },
    'plugins': [
        '@typescript-eslint'
    ],
    'env': {
        'es6': true,
        'node': true,
    },
    'extends': [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly',
    },
    'rules': {
        'eqeqeq': [
            'error',
            'always',
            {
                null: 'ignore'
            }
        ],
        "semi": ["error", "always"],
        "quotes": ["error", "single", { "avoidEscape": true }],
        "@typescript-eslint/no-angle-bracket-type-assertion": 'off',
        '@typescript-eslint/class-name-casing': 'error',
        "@typescript-eslint/indent": ["error", 2],
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': ["error"],
    },
    "overrides": [
        {
            "files": ["*.test.ts", "*.spec.ts"],
            "rules": {
                "no-unused-expressions": "off",
                'prefer-const': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/no-explicit-any': 'off',
            }
        }
    ]
};