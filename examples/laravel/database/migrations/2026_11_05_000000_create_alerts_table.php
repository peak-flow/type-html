<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            // Already-sanitized HTML from the editor. longText because MySQL TEXT caps at 64 KB.
            $table->longText('body');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
