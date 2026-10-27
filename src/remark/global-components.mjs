export default function remarkGlobalComponents() {
    return function (tree, file) {
        if (!file.path.endsWith('.mdx')) {
            return;
        }

        const importNode = {
            type: 'mdxjsEsm',
            value: "import Notation from '../../components/Notation.astro';",
            data: {
                estree: {
                    type: 'Program',
                    body: [
                        {
                            type: 'ImportDeclaration',
                            specifiers: [
                                {
                                    type: 'ImportDefaultSpecifier',
                                    local: { type: 'Identifier', name: 'Notation' }
                                }
                            ],
                            source: { type: 'Literal', value: '../../components/Notation.astro', raw: "'../../components/Notation.astro'" }
                        }
                    ],
                    sourceType: 'module'
                }
            }
        };

        tree.children.unshift(importNode);
    };
}
