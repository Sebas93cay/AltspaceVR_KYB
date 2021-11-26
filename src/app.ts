/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from "@microsoft/mixed-reality-extension-sdk";

/**
 * The main class of this app. All the logic goes here.
 */
export default class HelloWorld {
	private button: MRE.Actor = null;
	private assets: MRE.AssetContainer;

	constructor(private context: MRE.Context) {
		this.context.onStarted(() => this.started());
	}

	/**
	 * Once the context is "started", initialize the app.
	 */
	private started() {
		// set up somewhere to store loaded assets (meshes, textures, animations, gltfs, etc.)
		this.assets = new MRE.AssetContainer(this.context);

		// Create initial button
		this.button = MRE.Actor.CreateFromLibrary(this.context, {
			actor: {
				transform: {
					app: {
						position: { x: 0, y: 0, z: 0 },
					},
				},
			},
			resourceId: "artifact:1579239194507608147",
		});

		//button has to behave as a button
		const buttonBehavior = this.button.setBehavior(MRE.ButtonBehavior);

		//nice hover in button
		buttonBehavior.onHover("enter", () => {
			// use the convenience function "AnimateTo" instead of creating the animation data in advance
			MRE.Animation.AnimateTo(this.context, this.button, {
				destination: {
					transform: { local: { scale: { x: 1.2, y: 1.2, z: 1.2 } } },
				},
				duration: 0.3,
				easing: MRE.AnimationEaseCurves.EaseOutSine,
			});
		});
		buttonBehavior.onHover("exit", () => {
			MRE.Animation.AnimateTo(this.context, this.button, {
				destination: {
					transform: { local: { scale: { x: 1, y: 1, z: 1 } } },
				},
				duration: 0.3,
				easing: MRE.AnimationEaseCurves.EaseOutSine,
			});
		});
		buttonBehavior.onClick((user) => this.showKYB(user));
	}

	private showKYB(user: MRE.User) {
		console.log(`${user.name} has pressed the button`);
		user.prompt(
			`Bienvenido a su KYB VR
		Por favor introduzca la Razón Social:`,
			true
		).then((res) => {
			if (res.submitted && res.text.length > 0) {
				console.log("Lo logro");
			} else {
				user.prompt(
					"Lo sentimos pero la razón Social es necesaria para la busqueda"
				);
			}
		});
	}
}
