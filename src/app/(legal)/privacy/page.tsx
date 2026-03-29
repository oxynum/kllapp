import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialit\u00e9 \u2014 KLLAPP",
  description:
    "Politique de confidentialit\u00e9 de KLLAPP, plateforme de gestion de capacit\u00e9 et de temps.",
};

export default function PrivacyPage() {
  return (
    <article className="prose-legal">
      <h1>Politique de confidentialit&eacute;</h1>
      <p className="lead">
        Derni&egrave;re mise &agrave; jour&nbsp;: 4 mars 2026
      </p>

      <p>
        KLLAPP est un service &eacute;dit&eacute; par <strong>TRENTE TROIS</strong>,
        SARL unipersonnelle au capital social de 500&nbsp;&euro;, dont le
        si&egrave;ge social est situ&eacute; au 128 rue La Bo&eacute;tie, 75008
        Paris, immatricul&eacute;e au RCS de Paris sous le num&eacute;ro
        851&nbsp;312&nbsp;553 (TVA&nbsp;: FR33851312553), repr&eacute;sent&eacute;e
        par M.&nbsp;Rudy Thimothee, g&eacute;rant.
      </p>

      <p>
        KLLAPP (&laquo;&nbsp;nous&nbsp;&raquo;, &laquo;&nbsp;notre&nbsp;&raquo;,
        &laquo;&nbsp;la Plateforme&nbsp;&raquo;) s&rsquo;engage &agrave; prot&eacute;ger
        la vie priv&eacute;e de ses utilisateurs. Cette politique de confidentialit&eacute;
        d&eacute;crit les donn&eacute;es que nous collectons, pourquoi nous les collectons
        et comment nous les utilisons.
      </p>

      <h2>1. Donn&eacute;es collect&eacute;es</h2>
      <p>Nous collectons les cat&eacute;gories de donn&eacute;es suivantes&nbsp;:</p>
      <ul>
        <li>
          <strong>Informations de compte</strong>&nbsp;: nom, adresse e-mail,
          photo de profil (via Google ou Gravatar).
        </li>
        <li>
          <strong>Donn&eacute;es d&rsquo;organisation</strong>&nbsp;: nom de
          l&rsquo;organisation, r&ocirc;le de l&rsquo;utilisateur, membres de
          l&rsquo;&eacute;quipe.
        </li>
        <li>
          <strong>Donn&eacute;es de planification</strong>&nbsp;: affectations
          projet, jours planifi&eacute;s, taux journaliers, budgets.
        </li>
        <li>
          <strong>Donn&eacute;es techniques</strong>&nbsp;: adresse IP, type de
          navigateur, pages consult&eacute;es, horodatages.
        </li>
      </ul>

      <h2>2. Utilisation des donn&eacute;es</h2>
      <p>Vos donn&eacute;es sont utilis&eacute;es pour&nbsp;:</p>
      <ul>
        <li>Fournir et am&eacute;liorer les services de la Plateforme.</li>
        <li>G&eacute;rer votre compte et vos acc&egrave;s.</li>
        <li>Permettre la collaboration en temps r&eacute;el entre membres.</li>
        <li>Envoyer des communications relatives au service (invitations, notifications).</li>
        <li>Assurer la s&eacute;curit&eacute; et pr&eacute;venir les abus.</li>
      </ul>

      <h2>3. Partage des donn&eacute;es</h2>
      <p>
        Nous ne vendons jamais vos donn&eacute;es personnelles. Nous pouvons
        partager des informations avec&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Sous-traitants techniques</strong>&nbsp;: h&eacute;bergement
          (Railway), base de donn&eacute;es (Neon/PostgreSQL), authentification
          (Google OAuth), collaboration temps r&eacute;el (Liveblocks), emails
          transactionnels (Resend).
        </li>
        <li>
          <strong>Obligations l&eacute;gales</strong>&nbsp;: si la loi
          l&rsquo;exige ou pour prot&eacute;ger nos droits.
        </li>
      </ul>

      <h2>4. S&eacute;curit&eacute;</h2>
      <p>
        Nous mettons en &oelig;uvre des mesures de s&eacute;curit&eacute;
        techniques et organisationnelles adapt&eacute;es&nbsp;: chiffrement des
        communications (HTTPS/TLS), authentification s&eacute;curis&eacute;e
        (JWT, OAuth 2.0), contr&ocirc;le d&rsquo;acc&egrave;s bas&eacute; sur
        les r&ocirc;les (RBAC), limitation de d&eacute;bit sur les points
        d&rsquo;acc&egrave;s sensibles.
      </p>

      <h2>5. Conservation des donn&eacute;es</h2>
      <p>
        Vos donn&eacute;es sont conserv&eacute;es tant que votre compte est
        actif. Vous pouvez demander la suppression de votre compte et de vos
        donn&eacute;es &agrave; tout moment en nous contactant.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Conform&eacute;ment au RGPD, vous disposez des droits suivants&nbsp;:
      </p>
      <ul>
        <li>Droit d&rsquo;acc&egrave;s &agrave; vos donn&eacute;es personnelles.</li>
        <li>Droit de rectification des donn&eacute;es inexactes.</li>
        <li>Droit &agrave; l&rsquo;effacement (&laquo;&nbsp;droit &agrave; l&rsquo;oubli&nbsp;&raquo;).</li>
        <li>Droit &agrave; la portabilit&eacute; de vos donn&eacute;es.</li>
        <li>Droit d&rsquo;opposition au traitement.</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez-nous &agrave;&nbsp;:{" "}
        <a href="mailto:privacy@kllapp.com">privacy@kllapp.com</a>
      </p>

      <h2>7. Cookies</h2>
      <p>
        KLLAPP utilise uniquement des cookies strictement n&eacute;cessaires au
        fonctionnement de l&rsquo;authentification et de la session utilisateur.
        Nous n&rsquo;utilisons pas de cookies publicitaires ni de trackers tiers.
      </p>

      <h2>8. Modifications</h2>
      <p>
        Nous pouvons mettre &agrave; jour cette politique. En cas de modification
        substantielle, nous vous en informerons par email ou via la Plateforme.
      </p>

      <h2>9. Contact</h2>
      <p>
        Pour toute question relative &agrave; la protection de vos donn&eacute;es&nbsp;:{" "}
        <a href="mailto:privacy@kllapp.com">privacy@kllapp.com</a>
      </p>
    </article>
  );
}
