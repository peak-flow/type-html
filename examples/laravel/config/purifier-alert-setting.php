<?php

/*
 * Not a standalone config file. After `php artisan vendor:publish --provider="Mews\Purifier\PurifierServiceProvider"`,
 * add this 'alert' entry inside the 'settings' array of config/purifier.php.
 * It mirrors the DOMPurify allowlist in src/common.js so the server keeps exactly what the editor can produce.
 */

return [
    'settings' => [
        'alert' => [
            'HTML.Doctype' => 'HTML 4.01 Transitional',
            'HTML.Allowed' => 'p,div,br,strong,b,em,i,h2,ul,ol,li,a[href|title]',
            'URI.AllowedSchemes' => ['http' => true, 'https' => true, 'mailto' => true],
            'AutoFormat.AutoParagraph' => false,
            'AutoFormat.RemoveEmpty' => true,
        ],
    ],
];
