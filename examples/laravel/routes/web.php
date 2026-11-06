<?php

use App\Http\Controllers\AlertController;
use Illuminate\Support\Facades\Route;

Route::resource('alerts', AlertController::class)->only(['create', 'store', 'show', 'edit', 'update']);
